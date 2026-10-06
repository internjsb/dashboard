import { Router } from "express";
import { requireAuth, requireActive, requirePageAccess, requireSuperAdmin } from "../middleware/authMiddleware.js";
import { db } from "../firebaseAdmin.js";
import { audit } from "../audit.js";
import { getSpreadsheetInfo, readSheetRows, sheetsServiceEmail } from "../googleSheets.js";
import {
  product,
  stats,
  revenueTrend,
  salesByFinish,
  variants,
  variantsByPeriod,
  recentOrders,
  salesHistory,
  stockAvailable,
  finance,
  saleReport,
} from "../data/sampleData.js";

const router = Router();

// Admins, "super_user", and "sales" can see the overview.
router.get("/overview", requireAuth, requireActive, requirePageAccess("dashboard"), async (req, res) => {
  res.json({
    product,
    stats,
    revenueTrend,
    salesByFinish,
    variants,
    variantsByPeriod,
    recentOrders,
  });
});

router.get("/stock", requireAuth, requireActive, async (req, res) => {
  res.json({ variants });
});

// Trailing 12-month sales history: totals, item engagement, sales by country,
// and user-base growth. Admins, "super_user", and "sales".
router.get("/sales-history", requireAuth, requireActive, requirePageAccess("sales_history"), async (req, res) => {
  res.json(salesHistory);
});

// On-hand inventory per finish and per fulfilment country, with each item
// flagged low/out so the client can surface a notification. Backs both the
// Stock available and Inventory frontend pages, so either grant unlocks it.
router.get(
  "/stock-available",
  requireAuth,
  requireActive,
  requirePageAccess(["stock_available", "inventory"]),
  async (req, res) => {
    const byItem = stockAvailable.byItem.map((it) => ({
      ...it,
      status: it.available <= 0 ? "out" : it.available <= it.reorderLevel ? "low" : "ok",
    }));
    res.json({
      byItem,
      byCountry: stockAvailable.byCountry,
      inventory: stockAvailable.inventory,
      shipments: stockAvailable.shipments,
    });
  },
);

// Transactions, taxes, and generated finance reports. Admins, "super_user",
// and "finance".
router.get("/finance", requireAuth, requireActive, requirePageAccess("finance"), async (req, res) => {
  res.json(finance);
});

// Per-order line items for the Sales report page, filterable by shipped date.
// Stored in RTDB at saleReport/{id} so edits and deletes stick; seeded from
// the sample data the first time it's read.
const SALE_REPORT_PATH = "saleReport";
const saleReportAccess = [requireAuth, requireActive, requirePageAccess("sale_report")];

// Seeds once, tracked by a flag — so deleting every row leaves it empty
// rather than bringing the sample rows back.
async function loadSaleReport() {
  if (!(await db.get("meta/saleReportSeeded"))) {
    await db.set(SALE_REPORT_PATH, Object.fromEntries(saleReport.map((r) => [r.id, r])));
    await db.set("meta/saleReportSeeded", true);
  }
  const stored = (await db.get(SALE_REPORT_PATH)) || {};
  return Object.values(stored).sort((a, b) => b.shippedDate.localeCompare(a.shippedDate));
}

router.get("/sale-report", ...saleReportAccess, async (req, res) => {
  try {
    res.json({ rows: await loadSaleReport() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load sales report" });
  }
});

// Edit one row. Unit price is always recomputed as sales price / qty.
router.patch("/sale-report/:id", ...saleReportAccess, async (req, res) => {
  const { id } = req.params;
  const b = req.body || {};
  const str = (v) => (typeof v === "string" ? v.trim() : "");
  const row = {
    id,
    category: str(b.category),
    itemCode: str(b.itemCode),
    set: Number(b.set),
    qty: Number(b.qty),
    productSalesPrice: Number(b.productSalesPrice),
    orderId: str(b.orderId),
    fulfillment: str(b.fulfillment),
    shippedDate: str(b.shippedDate),
  };

  if (!row.category || !row.itemCode || !row.orderId || !row.fulfillment) {
    return res.status(400).json({ error: "Category, item code, order id and fulfillment are required" });
  }
  if (!Number.isInteger(row.set) || row.set < 0) {
    return res.status(400).json({ error: "Set must be a whole number" });
  }
  if (!Number.isInteger(row.qty) || row.qty < 1) {
    return res.status(400).json({ error: "QTY must be a whole number of at least 1" });
  }
  if (!Number.isFinite(row.productSalesPrice) || row.productSalesPrice < 0) {
    return res.status(400).json({ error: "Product sales price must be 0 or more" });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.shippedDate)) {
    return res.status(400).json({ error: "Shipped date must be YYYY-MM-DD" });
  }
  row.unitPrice = Math.round((row.productSalesPrice / row.qty) * 100) / 100;

  try {
    await loadSaleReport();
    if ((await db.get(`${SALE_REPORT_PATH}/${id}`)) == null) {
      return res.status(404).json({ error: "Row not found" });
    }
    await db.set(`${SALE_REPORT_PATH}/${id}`, row);
    await audit(req, "sale_report.update", { id, orderId: row.orderId });
    res.json({ row });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update row" });
  }
});

router.delete("/sale-report/:id", ...saleReportAccess, async (req, res) => {
  const { id } = req.params;
  try {
    await loadSaleReport();
    const existing = await db.get(`${SALE_REPORT_PATH}/${id}`);
    if (existing == null) return res.status(404).json({ error: "Row not found" });
    await db.remove(`${SALE_REPORT_PATH}/${id}`);
    await audit(req, "sale_report.delete", { id, orderId: existing.orderId });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete row" });
  }
});

// --- Products (catalog) ------------------------------------------------------
// The browser reads products/ straight from RTDB (rules allow public read) but
// can't write it (".write": false), so adds/edits/deletes go through here,
// gated on the "products" page grant.
const PRODUCTS_PATH = "products";
const productsAccess = [requireAuth, requireActive, requirePageAccess("products")];

const PRODUCT_TEXT_FIELDS = [
  "sku",
  "division",
  "dtiItemCode",
  "dtiItemDescription",
  "type",
  "country",
  "asin",
  "fnsku",
  "ean",
  "description",
  "status",
];
const PRODUCT_OPTIONAL_FIELDS = new Set(["fnsku", "ean"]);
const PRODUCT_STATUS_OPTIONS = ["Active", "Inactive"];

// Returns { product } or { error }. `excludeId` lets an edit keep its own S/N.
async function validateProduct(body, excludeId) {
  const b = body || {};
  const product = {};
  for (const key of PRODUCT_TEXT_FIELDS) {
    product[key] = typeof b[key] === "string" ? b[key].trim() : "";
    if (!PRODUCT_OPTIONAL_FIELDS.has(key) && !product[key]) return { error: `${key} is required` };
  }
  if (!PRODUCT_STATUS_OPTIONS.includes(product.status)) return { error: "Status must be Active or Inactive" };

  product.sn = Number(b.sn);
  if (!Number.isFinite(product.sn) || product.sn <= 0) return { error: "S/N must be a positive number" };
  product.set = Number(b.set);
  if (!Number.isInteger(product.set) || product.set <= 0) return { error: "Set must be a positive whole number" };

  const existing = (await db.get(PRODUCTS_PATH)) || {};
  const clash = Object.entries(existing).some(([id, p]) => id !== excludeId && p?.sn === product.sn);
  if (clash) return { error: `S/N ${product.sn} is already used. Choose a different number.` };

  return { product };
}

router.post("/products", ...productsAccess, async (req, res) => {
  try {
    const { product, error } = await validateProduct(req.body);
    if (error) return res.status(400).json({ error });
    const { name: id } = await db.push(PRODUCTS_PATH, { ...product, createdAt: { ".sv": "timestamp" } });
    await audit(req, "product.create", { id, sku: product.sku });
    res.status(201).json({ id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add product" });
  }
});

router.patch("/products/:id", ...productsAccess, async (req, res) => {
  const { id } = req.params;
  try {
    if ((await db.get(`${PRODUCTS_PATH}/${id}`)) == null) return res.status(404).json({ error: "Product not found" });
    const { product, error } = await validateProduct(req.body, id);
    if (error) return res.status(400).json({ error });
    await db.update(`${PRODUCTS_PATH}/${id}`, { ...product, updatedAt: { ".sv": "timestamp" } });
    await audit(req, "product.update", { id, sku: product.sku });
    res.json({ id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update product" });
  }
});

router.delete("/products/:id", ...productsAccess, async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await db.get(`${PRODUCTS_PATH}/${id}`);
    if (existing == null) return res.status(404).json({ error: "Product not found" });
    await db.remove(`${PRODUCTS_PATH}/${id}`);
    await audit(req, "product.delete", { id, sku: existing.sku });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

// --- Google Sheets connection check ----------------------------------------
// Super admin only: confirms GOOGLE_CREDENTIALS_JSON works and the spreadsheet
// in GOOGLE_SHEET_ID (or ?id=) is shared with the service account. Returns the
// sheet's tabs plus the first few rows of ?range= (defaults to the first tab).
router.get("/sheets/test", requireAuth, requireSuperAdmin, async (req, res) => {
  const spreadsheetId = req.query.id || process.env.GOOGLE_SHEET_ID;
  let serviceEmail = null;
  try {
    serviceEmail = sheetsServiceEmail();
    if (!spreadsheetId) {
      return res.status(400).json({ error: "Set GOOGLE_SHEET_ID or pass ?id=<spreadsheet id>", serviceEmail });
    }
    const info = await getSpreadsheetInfo(spreadsheetId);
    const range = req.query.range || info.tabs[0];
    const rows = await readSheetRows(spreadsheetId, range);
    res.json({ ok: true, serviceEmail, ...info, range, rowCount: rows.length, sample: rows.slice(0, 5) });
  } catch (err) {
    console.error(err);
    res.status(502).json({ ok: false, serviceEmail, error: err.message });
  }
});

export default router;
