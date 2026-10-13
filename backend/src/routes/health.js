// backend/src/routes/health.js  (ES module)
// GET <mount-path>/db  ->  { ok: true } when Cloud SQL is reachable

import express from "express";
import { query } from "../db.js";
import {
  requireAuth,
  requireActive,
  requireAdmin,
  requirePageAccess,
  unlessLocalDev,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/db", async (req, res) => {
  try {
    await query("SELECT 1");
    res.json({ ok: true });
  } catch (err) {
    console.error("[health/db]", err.message);
    res.status(503).json({ ok: false, error: "Database unreachable" });
  }
});

// Test endpoint for the /testing page: raw ledger rows from Cloud SQL.
// Admin sign-in required — this is real business data.
// router.get("/orders", requireAuth, requireActive, requireAdmin, async (req, res) => {
//   try {
//     const result = await query("SELECT * FROM amazon.get_ledger_detail_view_data LIMIT 100");
//     res.json(result.rows);
//   } catch (err) {
//     console.error("[health/orders]", err.message);
    
//     res.status(500).json({ error: `Database error: ${err.message}` });
//   }
// });


// router.get("/amazon-skus", ...unlessLocalDev(requireAuth, requireActive, requirePageAccess("products")), async (req, res) => {
//   try {
//     // One row per SKU, newest snapshot first (the report is re-pulled over time).
//     const { rows } = await query(`
//       SELECT DISTINCT ON (sku) sku, fnsku, asin, product_name, available, snapshot_date
//         FROM amazon.get_fba_inventory_planning_data
//        ORDER BY sku, snapshot_date DESC`);
//     res.json({ rows });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Failed to load SKUs from the database" });
//   }
// });

router.get("/listing-data", ...unlessLocalDev(requireAuth, requireActive, requirePageAccess("product_listings")), async (req, res) => {
  try {
    // One row per Amazon listing: image, division, DTI code/description, type (Amazon product group), EAN.
    const { rows } = await query(`
      SELECT l.image_url                                                    AS image_url,
             regexp_replace(split_part(i.item_name, '-', 1), 'NIST$', '')  AS division,
             m.item_code                                                   AS dti_item_code,
             i.item_name                                                   AS dti_item_description,
             initcap(replace(regexp_replace(ip.product_group, '^gl_', ''), '_', ' ')) AS type,
             CASE WHEN l.product_id_type = '4' THEN l.product_id END      AS ean
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
                LIMIT 1) ip ON true`);
    res.json({ rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load listing data from the database" });
  }
});



router.get("/inventory_data", ...unlessLocalDev(requireAuth, requireActive, requirePageAccess("inventory")), async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT i.sku                                AS sku,
             COALESCE(c.item_name, i.product_name) AS item_name,
             l.country                            AS country,
             i.afn_warehouse_quantity             AS warehouse_quantity,
             i.afn_fulfillable_quantity           AS fulfillable_quantity,
             i.afn_unsellable_quantity            AS unsellable_quantity,
             i.afn_reserved_quantity              AS reserved_quantity
        FROM amazon.get_fba_myi_all_inventory_data i
        LEFT JOIN LATERAL (
               SELECT country FROM amazon.get_ledger_detail_view_data d
                WHERE d.msku = i.sku
                ORDER BY d.date DESC NULLS LAST
                LIMIT 1) l ON true
        LEFT JOIN LATERAL (
               SELECT item_code FROM core.item_sku_map m
                WHERE m.seller_sku = i.sku AND m.marketplace_id = i.marketplace_id
                ORDER BY item_code
                LIMIT 1) m ON true
        LEFT JOIN core.items c
               ON c.item_code = m.item_code
       ORDER BY i.sku`);
    res.json({ rows });
  } catch (err) {
    console.error("[health/inventory_data]", err.message);
    res.status(500).json({ error: "Failed to load inventory from the database" });
  }
});



router.get("/shipment_data", ...unlessLocalDev(requireAuth, requireActive, requirePageAccess("inventory")), async (req, res) => {
  try {

    const { rows } = await query(`
      SELECT sku,
             amazon_order_id  AS order_id,
             product_name,
             quantity_shipped AS shipment_qty,
             tracking_number,
             currency,
             purchase_date,
             sales_channel
        FROM amazon.get_amazon_fulfilled_shipments_data_general
       ORDER BY purchase_date DESC NULLS LAST`);
    res.json({ rows });
  } catch (err) {
    console.error("[health/shipment_data]", err.message);
    res.status(500).json({ error: "Failed to load shipments from the database" });
  }
});

router.get("/recent_order", ...unlessLocalDev(requireAuth, requireActive, requirePageAccess("inventory")), async (req, res) => {
  try {

    const { rows } = await query(`
    Select  p.product_name      as Item_Name,
		        i.units_per_sku     as unit,
		        a.sku               as SKU,
		        i.item_code         as DTI_code,
		        a.item_price        as Price
		from core.item_sku_map i
		left join amazon.get_amazon_fulfilled_shipments_data_general a
		on a.marketplace_id = i.marketplace_id
		left join core.products p
		on a.marketplace_id = p.marketplace_id
		`);
    res.json({ rows });
  } catch (err) {
    console.error("[health/shipment_data]", err.message);
    res.status(500).json({ error: "Failed to load shipments from the database" });
  }
});



router.get("/sale_report", ...unlessLocalDev(requireAuth, requireActive, requirePageAccess("sale_report")), async (req, res) => {
  try {

    const { rows } = await query(`
    select    a.purchase_date                       as  Purchase_date,
		          a.product_name                        as  Item_Code,
		          b.units_per_sku                       as  Set_,
		          a.quantity_shipped                    as  QTY,
		          c.price                               as  Product_Sale_Price,
		          Round((c.price/a.quantity_shipped),2) as  Unit_price,
		          a.amazon_order_id                     as  Order_id,
		          c.fulfillment_channel                 as  Fulfilment,
		          a.shipment_date                       as  Shipped_date
		          From amazon.get_amazon_fulfilled_shipments_data_general a
		          Left join core.item_sku_map b
		          On a.sku = b.seller_sku 
		          Left join amazon.get_merchant_listings_all_data c
		          On a.sku = c.seller_sku;
		`);
    res.json({ rows });
  } catch (err) {
    console.error("[health/shipment_data]", err.message);
    res.status(500).json({ error: "Failed to load shipments from the database" });
  }
});



export default router;
