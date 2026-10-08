import { Router } from "express";
import { requireAuth, requireActive, requirePageAccess, requireSuperAdmin } from "../middleware/authMiddleware.js";
import multer from "multer";
import { getDownloadURL } from "firebase-admin/storage";
import { db, storageBucket } from "../firebaseAdmin.js";
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

// --- AMAZON Listing ----------------------------------------------------------
// Rows added from the "Add a new product" listing page. Kept separate from the
// products catalog because a listing only carries these five fields + an image.
// The image goes to Firebase Storage at listings/{id}/…; the row stores its
// download URL (imageUrl) and storage path (imagePath).
const LISTINGS_PATH = "listings";
const listingsAccess = [requireAuth, requireActive, requirePageAccess("product_listings")];
const LISTING_FIELDS = ["division", "dtiItemCode", "dtiItemDescription", "type", "ean"];
const LISTING_REQUIRED = new Set(["division", "dtiItemCode", "dtiItemDescription", "type"]);

router.get("/listings", ...listingsAccess, async (req, res) => {
  try {
    const stored = (await db.get(LISTINGS_PATH)) || {};
    const rows = Object.entries(stored)
      .map(([id, r]) => ({ id, ...r }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    res.json({ rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load listings" });
  }
});

// PNG and JPG only — WEBP and GIF are not accepted.
const IMAGE_TYPES = new Set(["image/png", "image/jpeg"]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  fileFilter: (req, file, cb) => cb(null, IMAGE_TYPES.has(file.mimetype)),
}).single("image");

// Wraps multer so its errors come back as a normal 400 JSON response.
function parseImage(req, res, next) {
  imageUpload(req, res, (err) => {
    if (!err) return next();
    const tooBig = err.code === "LIMIT_FILE_SIZE";
    res.status(400).json({ error: tooBig ? "Image must be 5 MB or smaller" : "Couldn't read the uploaded image" });
  });
}

async function saveListingImage(id, file) {
  const ext = { "image/png": "png", "image/jpeg": "jpg" }[file.mimetype];
  const path = `${LISTINGS_PATH}/${id}/${Date.now()}.${ext}`;
  const ref = storageBucket().file(path);
  await ref.save(file.buffer, { contentType: file.mimetype, resumable: false });
  return { imagePath: path, imageUrl: await getDownloadURL(ref) };
}

// multipart/form-data: the five text fields + an optional "image" file.
router.post("/listings", ...listingsAccess, parseImage, async (req, res) => {
  const b = req.body || {};
  const row = {};
  for (const key of LISTING_FIELDS) {
    row[key] = typeof b[key] === "string" ? b[key].trim() : "";
    if (LISTING_REQUIRED.has(key) && !row[key]) return res.status(400).json({ error: `${key} is required` });
  }
  if (req.body?.hasImage === "true" && !req.file) {
    return res.status(400).json({ error: "Image must be a PNG or JPG" });
  }

  let id = null;
  try {
    ({ name: id } = await db.push(LISTINGS_PATH, {
      ...row,
      imageUrl: null,
      imagePath: null,
      createdAt: { ".sv": "timestamp" },
    }));
    let image = { imageUrl: null, imagePath: null };
    if (req.file) {
      image = await saveListingImage(id, req.file);
      await db.update(`${LISTINGS_PATH}/${id}`, image);
    }
    await audit(req, "listing.create", {
      id,
      rowNo: 1, // newest first, so a new row is No. 1 in the table
      dtiItemCode: row.dtiItemCode,
      dtiItemDescription: row.dtiItemDescription,
      hasImage: !!req.file,
    });
    res.status(201).json({ id, ...image });
  } catch (err) {
    console.error(err);
    // Don't leave a half-saved row behind if the image upload failed.
    if (id) await db.remove(`${LISTINGS_PATH}/${id}`).catch(() => {});
    const notConfigured = /FIREBASE_STORAGE_BUCKET/.test(err?.message || "");
    res.status(500).json({
      error: notConfigured
        ? "Image storage isn't configured on the server (FIREBASE_STORAGE_BUCKET)"
        : req.file
          ? "Failed to upload the image"
          : "Failed to add listing",
    });
  }
});

router.get("/listings/:id", ...listingsAccess, async (req, res) => {
  try {
    const row = await db.get(`${LISTINGS_PATH}/${req.params.id}`);
    if (row == null) return res.status(404).json({ error: "Listing not found" });
    res.json({ row: { id: req.params.id, ...row } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load listing" });
  }
});

async function deleteListingImage(path) {
  if (!path) return;
  await storageBucket()
    .file(path)
    .delete({ ignoreNotFound: true })
    .catch((err) => console.error("listing image delete failed:", err.message));
}

// multipart/form-data like POST. A new "image" replaces the old one;
// removeImage=true clears it; otherwise the current image is kept.
router.patch("/listings/:id", ...listingsAccess, parseImage, async (req, res) => {
  const { id } = req.params;
  const b = req.body || {};
  const row = {};
  for (const key of LISTING_FIELDS) {
    row[key] = typeof b[key] === "string" ? b[key].trim() : "";
    if (LISTING_REQUIRED.has(key) && !row[key]) return res.status(400).json({ error: `${key} is required` });
  }
  if (b.hasImage === "true" && !req.file) {
    return res.status(400).json({ error: "Image must be a PNG or JPG" });
  }

  try {
    const existing = await db.get(`${LISTINGS_PATH}/${id}`);
    if (existing == null) return res.status(404).json({ error: "Listing not found" });

    let image = { imageUrl: existing.imageUrl ?? null, imagePath: existing.imagePath ?? null };
    if (req.file) {
      image = await saveListingImage(id, req.file);
    } else if (b.removeImage === "true") {
      image = { imageUrl: null, imagePath: null };
    }
    await db.update(`${LISTINGS_PATH}/${id}`, { ...row, ...image, updatedAt: { ".sv": "timestamp" } });
    // Only drop the old file once the row points at the new state.
    if (existing.imagePath && existing.imagePath !== image.imagePath) await deleteListingImage(existing.imagePath);

    // What happened to the photo: added / replaced / removed, or null if untouched.
    const imageChange = req.file
      ? existing.imagePath
        ? "replaced"
        : "added"
      : existing.imagePath && !image.imagePath
        ? "removed"
        : null;
    await audit(req, "listing.update", {
      id,
      rowNo: Number(b.rowNo) || null,
      dtiItemCode: row.dtiItemCode,
      dtiItemDescription: row.dtiItemDescription,
      changes: diffFields(existing, row, LISTING_FIELDS),
      imageChange,
    });
    res.json({ id, ...image });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: req.file ? "Failed to upload the image" : "Failed to update listing" });
  }
});

router.delete("/listings/:id", ...listingsAccess, async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await db.get(`${LISTINGS_PATH}/${id}`);
    if (existing == null) return res.status(404).json({ error: "Listing not found" });
    await db.remove(`${LISTINGS_PATH}/${id}`);
    await deleteListingImage(existing.imagePath);
    await audit(req, "listing.delete", {
      id,
      rowNo: Number(req.query.no) || null,
      dtiItemCode: existing.dtiItemCode,
      dtiItemDescription: existing.dtiItemDescription,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete listing" });
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
