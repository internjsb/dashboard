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
             m.item_name                                                   AS dti_item_description,
             initcap(replace(regexp_replace(ip.product_group, '^gl_', ''), '_', ' ')) AS type,
             CASE WHEN l.product_id_type = '4' THEN l.product_id END      AS ean,
             l.marketplace_id                                              AS marketplace_id
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
      SELECT i.sku                                 AS sku,
             COALESCE(c.item_name, i.product_name) AS item_name,
             l.country                             AS country,
             i.afn_warehouse_quantity              AS warehouse_quantity,
             i.afn_fulfillable_quantity            AS fulfillable_quantity,
             i.afn_unsellable_quantity             AS unsellable_quantity,
             i.afn_reserved_quantity               AS reserved_quantity,
             i.marketplace_id                      AS marketplace_id
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
             sales_channel,
             marketplace_id
        FROM amazon.get_amazon_fulfilled_shipments_data_general
       ORDER BY purchase_date DESC NULLS LAST`);
    res.json({ rows });
  } catch (err) {
    console.error("[health/shipment_data]", err.message);
    res.status(500).json({ error: "Failed to load shipments from the database" });
  }
});


router.get("/sale_report", ...unlessLocalDev(requireAuth, requireActive, requirePageAccess("sale_report")), async (req, res) => {
  try {

    const { rows } = await query(`
      select to_char(a.purchase_date, 'DD/MM/YY') as Purchase_date,
		d.item_code                                   as Item_Code,
		b.units_per_sku                               as Set_,
		a.quantity_shipped                            as QTY,
		a.item_price                                  as Product_Sale_Price,
		Round((c.price/a.quantity_shipped),2)         as Unit_price,
		a.amazon_order_id                             as Order_id,
		c.fulfillment_channel                         as Fulfillment,
		to_char(a.shipment_date, 'DD/MM/YY')          as Shipped_date,
		a.marketplace_id                              as marketplace_id
		from amazon.get_amazon_fulfilled_shipments_data_general a
		left join core.item_sku_map b
		on a.sku = b.seller_sku 
		left join amazon.get_merchant_listings_all_data c
		on a.sku = c.seller_sku
		left join core.items d
		on d.item_name = c.item_name;
`);
    res.json({ rows });
  } catch (err) {
    console.error("[health/shipment_data]", err.message);
    res.status(500).json({ error: "Failed to load shipments from the database" });
  }
});


router.get("/recent_order", ...unlessLocalDev(requireAuth, requireActive, requirePageAccess("dashboard")), async (req, res) => {
  try {
    // Dashboard "Recent orders": one row per shipped order line, newest first.
    // Column names match the OrderRow interface in RecentOrders.tsx. Joined on
    // the SKU (joining on marketplace alone paired every SKU with every order).
    const { rows } = await query(`
    SELECT 
           COALESCE(p.product_name, a.product_name, '')                           AS item_name,
           a.sku                                                                  AS sku,
           COALESCE(i.item_code, '')                                              AS "dtiItemCode",
           COALESCE(i.units_per_sku, 0)                                           AS qty,
           COALESCE(a.item_price * i.units_per_sku, 0)::float8                    AS "Price",
           a.marketplace_id                                                       AS marketplace_id
      FROM amazon.get_amazon_fulfilled_shipments_data_general a
      LEFT JOIN core.item_sku_map i
             ON i.seller_sku = a.sku AND i.marketplace_id = a.marketplace_id
      LEFT JOIN core.products p
             ON p.seller_sku = a.sku AND p.marketplace_id = a.marketplace_id
     ORDER BY a.purchase_date DESC NULLS LAST
     LIMIT 100`);
    res.json({ rows });
  } catch (err) {
    console.error("[health/recent_order]", err.message);
    res.status(500).json({ error: "Failed to load recent orders from the database" });
  }
});

// DTI items for the AMAZON Listing form's "DTI Item Code" picker — the same
// items the Product Listing page shows (core.items). Gated on the "products"
// page, since AMAZON Listing users may not have Product Listing access.
router.get("/dti_items", ...unlessLocalDev(requireAuth, requireActive, requirePageAccess("products")), async (req, res) => {
  try {
    const { rows } = await query(`
      -- Division / Type / EAN the same way the Product Listing page shows them:
      -- Type = Amazon's product group (latest snapshot), EAN = the listing's
      -- product id when it's an EAN (type 4). Both look across ALL of the
      -- item's SKUs, since its first SKU may not have one.
      SELECT i.item_code                                                 AS "dtiItemCode",
             COALESCE(i.item_name, '')                                   AS "dtiItemDescription",
             regexp_replace(split_part(COALESCE(i.item_name, ''), '-', 1), 'NIST$', '') AS division,
             COALESCE(initcap(replace(regexp_replace(pg.product_group, '^gl_', ''), '_', ' ')), '') AS type,
             COALESCE(e.ean, '')                                         AS ean,
             -- core.items has no marketplace_id: an item can be sold in several
             -- marketplaces, so list every one it has a SKU in.
             ARRAY(SELECT DISTINCT m.marketplace_id FROM core.item_sku_map m
                    WHERE m.item_code = i.item_code)                      AS marketplace_ids
        FROM core.items i
        LEFT JOIN LATERAL (
               SELECT f.product_group
                 FROM core.item_sku_map m
                 JOIN amazon.get_fba_inventory_planning_data f
                   ON f.sku = m.seller_sku AND f.marketplace_id = m.marketplace_id
                WHERE m.item_code = i.item_code AND f.product_group IS NOT NULL
                ORDER BY f.snapshot_date DESC, m.seller_sku
                LIMIT 1) pg ON true
        LEFT JOIN LATERAL (
               SELECT l.product_id AS ean
                 FROM core.item_sku_map m
                 JOIN amazon.get_merchant_listings_all_data l
                   ON l.seller_sku = m.seller_sku AND l.marketplace_id = m.marketplace_id
                WHERE m.item_code = i.item_code AND l.product_id_type = '4' AND l.product_id IS NOT NULL
                ORDER BY m.seller_sku
                LIMIT 1) e ON true
       ORDER BY i.item_code`);
    res.json({ rows });
  } catch (err) {
    console.error("[health/dti_items]", err.message);
    res.status(500).json({ error: "Failed to load DTI items from the database" });
  }
});


router.get("/refund_table", ...unlessLocalDev(requireAuth, requireActive), async (req, res) => {
  try {
    const { rows } = await query(`
  

SELECT DISTINCT ON (sku) transaction_type, Return_Date,
	   Item_Code,
	   Set_,
	   Qty,
	   product_refund_price,
	   unit_price,
	   Order_id,
	   detailed_disposition,
	   Reason,
	   Status,
	   fulfillment,
	   Purchase_Date,
	   marketplace_id
FROM (
    SELECT  c.transaction_type                    as transaction_type,
			to_char(a.return_date, 'DD/MM/YY')          as Return_Date,
			a.sku                                       as sku,
			d.item_code                                 as Item_Code,
		  d.units_per_sku                             as Set_,
			a.quantity                                  as Qty,
      c.amount                                    as product_refund_price,
      round((c.amount / a.quantity),2)            as unit_price,
			a.order_id                                  as Order_id,
      a.detailed_disposition                      as detailed_disposition,
      a.reason                                    as Reason,
      a.status                                    as Status,
			c.marketplace_name                          as fulfillment,
      to_char(b.purchase_date,'DD/MM/YY')         as Purchase_Date,
      a.marketplace_id                            as marketplace_id
    FROM amazon.get_fba_fulfillment_customer_returns_data a
    inner JOIN amazon.get_amazon_fulfilled_shipments_data_general b
            ON a.sku = b.sku
    inner JOIN amazon.get_v2_settlement_report_data_flat_file_v2 c
            ON c.marketplace_id = a.marketplace_id
	left join core.item_sku_map d
			on d.seller_sku = a.sku
    WHERE c.transaction_type = 'Refund'
      AND c.amount_description = 'Principal'
) t
ORDER BY sku;
    `);
    res.json({ rows });
  } catch (err) {
    console.error("[health/refund_table]", err.message);
    res.status(500).json({ error: "Failed to load refunds from the database" });
  }
});

router.get("/stocks", ...unlessLocalDev(requireAuth, requireActive), async (req, res) => {
  try {
    const { rows } = await query(`
      Select	a.merchant_sku	as sku,
          b.item_code         as product_item_code,
          a.product_name 	    as item_description,
          a.available 	      as available,
          a.inbound 		      as inbound,
          a.total_units	      as total_units,
          a.alert			        as status,
          a.marketplace_id    as marketplace_id
      from amazon.get_restock_inventory_recommendations_report a
      left join core.items b
      on a.product_name = b.item_name
    `);
    res.json({ rows });
  } catch (err) {
    console.error("[health/refund_table]", err.message);
    res.status(500).json({ error: "Failed to load refunds from the database" });
  }
});

export default router;
