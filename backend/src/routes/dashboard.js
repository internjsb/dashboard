import { Router } from "express";
import {
  requireAuth,
  requireActive,
  requirePageAccess,
  requireSuperAdmin,
  unlessLocalDev,
} from "../middleware/authMiddleware.js";
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

import { query, getClient } from "../db.js";

const router = Router();

// --- Product Listing (Postgres only) ------------------------------------------------
// The page lists, from the tables it pulls from:
//   • Amazon rows — amazon.get_merchant_listings_all_data joined to your item
//     mapping (core.item_sku_map) and items (core.items); and
//   • your own items with no Amazon listing yet (core.items only) — what
//     "Add new product" creates.
// The dashboard login can write core.items and core.item_sku_map only, so DTI
// item / DTI Item Description (and the SKU link) are editable; EAN and Type come
// from Amazon's tables and are read-only; there is no photo storage.

// Amazon listings hidden from the Product Listing page, keyed by SKU (Firebase).
const HIDDEN_AMAZON_PATH = "hiddenAmazonListings";
// Firebase keys can't contain . # $ [ ] /
const amazonKey = (sku) => encodeURIComponent(String(sku ?? "")).replace(/\./g, "%2E");
// Amazon US — the only marketplace in the data so far; used for new SKU links.
const DEFAULT_MARKETPLACE = "ATVPDKIKX0DER";
const DIVISION_SQL = (col) => `regexp_replace(split_part(${col}, '-', 1), 'NIST$', '')`;

const listingDataAccess = unlessLocalDev(requireAuth, requireActive, requirePageAccess("product_listings"));

// Amazon rows (one per listing). $1 = optional SKU filter.
function amazonListingSql(oneSku) {
  return `
SELECT 'amazon'                                                       AS source,
       l.seller_sku                                                   AS sku,
       l.marketplace_id                                               AS marketplace_id,
       l.image_url                                                    AS image_url,
       ${DIVISION_SQL("i.item_name")}                                 AS division,
       m.item_code                                                    AS dti_item_code,
       i.item_name                                                    AS dti_item_description,
       initcap(replace(regexp_replace(ip.product_group, '^gl_', ''), '_', ' ')) AS type,
       CASE WHEN l.product_id_type = '4' THEN l.product_id END       AS ean
FROM amazon.get_merchant_listings_all_data l
LEFT JOIN core.item_sku_map m
       ON m.seller_sku = l.seller_sku AND m.marketplace_id = l.marketplace_id
LEFT JOIN core.items i
       ON i.item_code = m.item_code
LEFT JOIN LATERAL (
       SELECT product_group
       FROM amazon.get_fba_inventory_planning_data f
       WHERE f.sku = l.seller_sku AND f.marketplace_id = l.marketplace_id
       ORDER BY f.snapshot_date DESC
       LIMIT 1) ip ON true
${oneSku ? "WHERE l.seller_sku = $1" : ""}`;
}

// Your items that have no Amazon listing yet (newest first). $1 = optional item code.
function itemOnlySql(oneCode) {
  return `
SELECT 'item'                                AS source,
       sm.seller_sku                         AS sku,
       sm.marketplace_id                     AS marketplace_id,
       NULL::text                            AS image_url,
       ${DIVISION_SQL("i.item_name")}        AS division,
       i.item_code                           AS dti_item_code,
       i.item_name                           AS dti_item_description,
       NULL::text                            AS type,
       NULL::text                            AS ean
FROM core.items i
LEFT JOIN LATERAL (
       SELECT seller_sku, marketplace_id FROM core.item_sku_map m
       WHERE m.item_code = i.item_code ORDER BY seller_sku LIMIT 1) sm ON true
WHERE NOT EXISTS (
       SELECT 1 FROM core.item_sku_map m
       JOIN amazon.get_merchant_listings_all_data l
         ON l.seller_sku = m.seller_sku AND l.marketplace_id = m.marketplace_id
       WHERE m.item_code = i.item_code)
${oneCode ? "AND i.item_code = $1" : ""}
ORDER BY i.created_at DESC`;
}

router.get("/listing-data", ...listingDataAccess, async (req, res) => {
  try {
    const [items, amazon] = await Promise.all([query(itemOnlySql(false)), query(amazonListingSql(false))]);
    // Amazon rows someone "deleted" on the page are only hidden from the
    // dashboard — Amazon's data in Cloud SQL is untouched.
    const hidden = (await db.get(HIDDEN_AMAZON_PATH)) || {};
    res.json({ rows: [...items.rows, ...amazon.rows.filter((r) => !hidden[amazonKey(r.sku)])] });
  } catch (err) {
    console.error("[listing-data]", err.message);
    res.status(500).json({ error: "Failed to load listing data from the database" });
  }
});

router.get("/listing-data/:sku", ...listingDataAccess, async (req, res) => {
  try {
    const { rows } = await query(amazonListingSql(true), [req.params.sku]);
    if (!rows.length) return res.status(404).json({ error: "Amazon listing not found" });
    res.json({ row: rows[0] });
  } catch (err) {
    console.error("[listing-data/:sku]", err.message);
    res.status(500).json({ error: "Failed to load this listing from the database" });
  }
});

// Shared by "edit Amazon row" and "edit your item": make sure the item exists
// with this description, inside an open transaction.
async function upsertItem(client, itemCode, itemName) {
  const upd = await client.query("UPDATE core.items SET item_name = $2 WHERE item_code = $1", [itemCode, itemName]);
  if (upd.rowCount === 0) {
    await client.query("INSERT INTO core.items (item_code, item_name) VALUES ($1, $2)", [itemCode, itemName]);
  }
}

const trimStr = (v) => (typeof v === "string" ? v.trim() : "");

// Edit an Amazon row: DTI item -> core.item_sku_map (this SKU only);
// DTI Item Description -> core.items (every SKU of that item).
router.patch("/listing-data/:sku", ...listingDataAccess, async (req, res) => {
  const sku = req.params.sku;
  const b = req.body || {};
  const next = { dtiItemCode: trimStr(b.dtiItemCode), dtiItemDescription: trimStr(b.dtiItemDescription) };
  if (!next.dtiItemCode || !next.dtiItemDescription) {
    return res.status(400).json({ error: "DTI item and DTI Item Description are required" });
  }
  let client;
  try {
    const found = await query(amazonListingSql(true), [sku]);
    if (!found.rows.length) return res.status(404).json({ error: "Amazon listing not found" });
    const before = found.rows[0];

    client = await getClient();
    await client.query("BEGIN");
    await upsertItem(client, next.dtiItemCode, next.dtiItemDescription); // item first (foreign key)
    await client.query(
      `INSERT INTO core.item_sku_map (marketplace_id, seller_sku, item_code) VALUES ($1, $2, $3)
       ON CONFLICT (marketplace_id, seller_sku) DO UPDATE SET item_code = EXCLUDED.item_code`,
      [before.marketplace_id, sku, next.dtiItemCode],
    );
    await client.query("COMMIT");

    await audit(req, "listing.update_amazon", {
      sku,
      rowNo: Number(b.rowNo) || null,
      dtiItemCode: next.dtiItemCode,
      changes: diffFields(
        { dtiItemCode: before.dti_item_code, dtiItemDescription: before.dti_item_description },
        next,
        ["dtiItemCode", "dtiItemDescription"],
      ),
    });
    res.json({ ok: true });
  } catch (err) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    console.error("[listing-data PATCH]", err.message);
    res.status(500).json({ error: "Failed to save this listing to the database" });
  } finally {
    client?.release();
  }
});

// "Delete" on an Amazon row: hide it from the dashboard (the dashboard's
// database login is read-only for Amazon's data, and the sync would bring it back).
router.post("/listing-data/hide", ...listingDataAccess, async (req, res) => {
  const sku = trimStr(req.body?.sku);
  if (!sku) return res.status(400).json({ error: "sku is required" });
  try {
    await db.set(`${HIDDEN_AMAZON_PATH}/${amazonKey(sku)}`, {
      sku,
      hiddenBy: req.user?.uid ?? null,
      at: { ".sv": "timestamp" },
    });
    await audit(req, "listing.hide_amazon", {
      sku,
      rowNo: Number(req.body?.rowNo) || null,
      dtiItemCode: trimStr(req.body?.dtiItemCode) || null,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to remove this listing" });
  }
});

// --- Your items (Add new product) ---------------------------------------------

router.get("/listing-items/:code", ...listingDataAccess, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT i.item_code AS dti_item_code, i.item_name AS dti_item_description,
              ${DIVISION_SQL("i.item_name")} AS division,
              (SELECT seller_sku FROM core.item_sku_map m WHERE m.item_code = i.item_code ORDER BY seller_sku LIMIT 1) AS sku
         FROM core.items i WHERE i.item_code = $1`,
      [req.params.code],
    );
    if (!rows.length) return res.status(404).json({ error: "Item not found" });
    res.json({ row: rows[0] });
  } catch (err) {
    console.error("[listing-items/:code]", err.message);
    res.status(500).json({ error: "Failed to load this item" });
  }
});

// Add new product -> a new row in core.items (+ an optional Amazon SKU link).
router.post("/listing-items", ...listingDataAccess, async (req, res) => {
  const b = req.body || {};
  const code = trimStr(b.dtiItemCode);
  const name = trimStr(b.dtiItemDescription);
  const sku = trimStr(b.sku);
  if (!code || !name) return res.status(400).json({ error: "DTI item and DTI Item Description are required" });
  let client;
  try {
    client = await getClient();
    await client.query("BEGIN");
    const exists = await client.query("SELECT 1 FROM core.items WHERE item_code = $1", [code]);
    if (exists.rowCount) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: `DTI item ${code} already exists` });
    }
    await client.query("INSERT INTO core.items (item_code, item_name) VALUES ($1, $2)", [code, name]);
    if (sku) {
      const taken = await client.query(
        "SELECT item_code FROM core.item_sku_map WHERE marketplace_id = $1 AND seller_sku = $2",
        [DEFAULT_MARKETPLACE, sku],
      );
      if (taken.rowCount) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: `SKU ${sku} is already linked to DTI item ${taken.rows[0].item_code}` });
      }
      await client.query("INSERT INTO core.item_sku_map (marketplace_id, seller_sku, item_code) VALUES ($1, $2, $3)", [
        DEFAULT_MARKETPLACE,
        sku,
        code,
      ]);
    }
    await client.query("COMMIT");
    await audit(req, "listing.create", { rowNo: 1, dtiItemCode: code, dtiItemDescription: name, sku: sku || null });
    res.status(201).json({ ok: true });
  } catch (err) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    console.error("[listing-items POST]", err.message);
    res.status(500).json({ error: "Failed to add this item to the database" });
  } finally {
    client?.release();
  }
});

// Edit your item: code / description (renaming the code carries its SKU links
// with it — core.item_sku_map's foreign key is ON UPDATE CASCADE).
router.patch("/listing-items/:code", ...listingDataAccess, async (req, res) => {
  const oldCode = req.params.code;
  const b = req.body || {};
  const code = trimStr(b.dtiItemCode);
  const name = trimStr(b.dtiItemDescription);
  if (!code || !name) return res.status(400).json({ error: "DTI item and DTI Item Description are required" });
  try {
    const before = await query("SELECT item_code, item_name FROM core.items WHERE item_code = $1", [oldCode]);
    if (!before.rowCount) return res.status(404).json({ error: "Item not found" });
    if (code !== oldCode) {
      const clash = await query("SELECT 1 FROM core.items WHERE item_code = $1", [code]);
      if (clash.rowCount) return res.status(409).json({ error: `DTI item ${code} already exists` });
    }
    await query("UPDATE core.items SET item_code = $2, item_name = $3 WHERE item_code = $1", [oldCode, code, name]);
    await audit(req, "listing.update", {
      rowNo: Number(b.rowNo) || null,
      dtiItemCode: code,
      changes: diffFields(
        { dtiItemCode: before.rows[0].item_code, dtiItemDescription: before.rows[0].item_name },
        { dtiItemCode: code, dtiItemDescription: name },
        ["dtiItemCode", "dtiItemDescription"],
      ),
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("[listing-items PATCH]", err.message);
    res.status(500).json({ error: "Failed to save this item to the database" });
  }
});

// Delete your item (only items with no Amazon listing are shown as yours).
router.delete("/listing-items/:code", ...listingDataAccess, async (req, res) => {
  const code = req.params.code;
  let client;
  try {
    const before = await query("SELECT item_name FROM core.items WHERE item_code = $1", [code]);
    if (!before.rowCount) return res.status(404).json({ error: "Item not found" });
    client = await getClient();
    await client.query("BEGIN");
    await client.query("DELETE FROM core.item_sku_map WHERE item_code = $1", [code]);
    await client.query("DELETE FROM core.items WHERE item_code = $1", [code]);
    await client.query("COMMIT");
    await audit(req, "listing.delete", {
      rowNo: Number(req.query.no) || null,
      dtiItemCode: code,
      dtiItemDescription: before.rows[0].item_name,
    });
    res.json({ ok: true });
  } catch (err) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    console.error("[listing-items DELETE]", err.message);
    res.status(500).json({ error: "Failed to delete this item" });
  } finally {
    client?.release();
  }
});


router.get("/amazon-skus", ...unlessLocalDev(requireAuth, requireActive, requirePageAccess("products")), async (req, res) => {
  try {
    // One row per SKU, newest snapshot first (the report is re-pulled over time).
    const { rows } = await query(`
      SELECT DISTINCT ON (sku) sku, fnsku, asin, product_name, available, snapshot_date, marketplace_id
        FROM amazon.get_fba_inventory_planning_data
       ORDER BY sku, snapshot_date DESC`);
    res.json({ rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load SKUs from the database" });
  }
});

// For the audit log: which fields an edit actually changed, as
// [{ field, from, to }]. Compared as trimmed strings so 1 and "1" match.
function diffFields(before, after, fields) {
  const changes = [];
  for (const field of fields) {
    const from = before?.[field] ?? "";
    const to = after?.[field] ?? "";
    if (String(from).trim() !== String(to).trim()) changes.push({ field, from, to });
  }
  return changes;
}

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
  return Object.values(stored)
    .map((r) => ({ ...r, unitPrice: unitPriceOf(r) }))
    .sort((a, b) => b.shippedDate.localeCompare(a.shippedDate));
}

// Unit price = product sales price ÷ QTY (the accounting format's
// "Unit price (Sales/Qty)"), rounded to cents. Always derived, never trusted
// from storage, so rows saved under an older formula still come out right.
function unitPriceOf(r) {
  const qty = Number(r.qty);
  return qty > 0 ? Math.round((Number(r.productSalesPrice) / qty) * 100) / 100 : 0;
}

// Amazon's API gives "2026-08-17T08:32:43+01:00"; the report wants
// "2026-08-17". Takes the date as written — no timezone conversion.
function shortDate(value) {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(typeof value === "string" ? value.trim() : "");
  return m ? m[1] : "";
}

router.get("/sale-report", ...saleReportAccess, async (req, res) => {
  try {
    res.json({ rows: await loadSaleReport() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load sales report" });
  }
});

// Edit one row. Unit price is always recomputed as QTY × sales price.
router.patch("/sale-report/:id", ...saleReportAccess, async (req, res) => {
  const { id } = req.params;
  const b = req.body || {};
  const str = (v) => (typeof v === "string" ? v.trim() : "");
  const row = {
    id,
    category: str(b.category),
    purchaseDate: shortDate(b.purchaseDate) || null,
    itemCode: str(b.itemCode),
    // Free text, e.g. "2pcs per pack"; blank for single items.
    set: typeof b.set === "number" ? String(b.set) : str(b.set),
    qty: Number(b.qty),
    productSalesPrice: Number(b.productSalesPrice),
    orderId: str(b.orderId),
    fulfillment: str(b.fulfillment),
    shippedDate: shortDate(b.shippedDate),
  };

  if (!row.category || !row.itemCode || !row.orderId || !row.fulfillment) {
    return res.status(400).json({ error: "Category, item code, order id and fulfillment are required" });
  }
  if (row.set.length > 100) {
    return res.status(400).json({ error: "Set must be 100 characters or fewer" });
  }
  if (b.purchaseDate && !row.purchaseDate) {
    return res.status(400).json({ error: "Purchase date must be YYYY-MM-DD" });
  }
  if (!Number.isInteger(row.qty) || row.qty < 1) {
    return res.status(400).json({ error: "QTY must be a whole number of at least 1" });
  }
  if (!Number.isFinite(row.productSalesPrice) || row.productSalesPrice < 0) {
    return res.status(400).json({ error: "Product sales price must be 0 or more" });
  }
  if (!row.shippedDate) {
    return res.status(400).json({ error: "Shipped date must be YYYY-MM-DD" });
  }
  // YYYY-MM-DD strings compare correctly as text. Same-day shipping is fine.
  if (row.purchaseDate && row.purchaseDate > row.shippedDate) {
    return res.status(400).json({ error: "Purchase date can't be after the shipped date" });
  }
  row.unitPrice = unitPriceOf(row);

  try {
    await loadSaleReport();
    const existing = await db.get(`${SALE_REPORT_PATH}/${id}`);
    if (existing == null) {
      return res.status(404).json({ error: "Row not found" });
    }
    await db.set(`${SALE_REPORT_PATH}/${id}`, row);
    await audit(req, "sale_report.update", {
      id,
      orderId: row.orderId,
      itemCode: row.itemCode,
      changes: diffFields(existing, row, [
        "category",
        "purchaseDate",
        "itemCode",
        "set",
        "qty",
        "productSalesPrice",
        "orderId",
        "fulfillment",
        "shippedDate",
      ]),
    });
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
    await audit(req, "sale_report.delete", { id, orderId: existing.orderId, itemCode: existing.itemCode });
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
  // Optional second DTI item (a product can be made of two).
  "dtiItemCode2",
  "dtiItemDescription2",
  "type",
  "country",
  "asin",
  "fnsku",
  "ean",
  "description",
  "status",
];
const PRODUCT_OPTIONAL_FIELDS = new Set(["fnsku", "ean", "dtiItemCode2", "dtiItemDescription2"]);
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
  if (product.dtiItemCode2 && product.dtiItemCode2 === product.dtiItemCode) {
    return { error: "The second DTI Item Code must be different from the first" };
  }
  if (!product.dtiItemCode2) product.dtiItemDescription2 = "";

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
    await audit(req, "product.create", { id, sku: product.sku, dtiItemDescription: product.dtiItemDescription });
    res.status(201).json({ id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add product" });
  }
});

router.patch("/products/:id", ...productsAccess, async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await db.get(`${PRODUCTS_PATH}/${id}`);
    if (existing == null) return res.status(404).json({ error: "Product not found" });
    const { product, error } = await validateProduct(req.body, id);
    if (error) return res.status(400).json({ error });
    await db.update(`${PRODUCTS_PATH}/${id}`, { ...product, updatedAt: { ".sv": "timestamp" } });
    await audit(req, "product.update", {
      id,
      sku: product.sku,
      dtiItemDescription: product.dtiItemDescription,
      changes: diffFields(existing, product, ["sn", "set", ...PRODUCT_TEXT_FIELDS]),
    });
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
    await audit(req, "product.delete", { id, sku: existing.sku, dtiItemDescription: existing.dtiItemDescription });
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
