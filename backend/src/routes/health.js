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

const RATE_QUOTES = "JPY,EUR,GBP,CAD,AUD,MXN,BRL,SEK,PLN,TRY,AED,SAR";
const ratesByDay = new Map(); 

// Amazon marketplace countries and the currency each one sells in.
const MARKETPLACE_COUNTRIES = [
  { country: "United States", code: "US", currency: "USD" },
  { country: "Japan", code: "JP", currency: "JPY" },
  { country: "Canada", code: "CA", currency: "CAD" },
  { country: "Mexico", code: "MX", currency: "MXN" },
  { country: "Brazil", code: "BR", currency: "BRL" },
  { country: "United Kingdom", code: "GB", currency: "GBP" },
  { country: "Germany", code: "DE", currency: "EUR" },
  { country: "France", code: "FR", currency: "EUR" },
  { country: "Italy", code: "IT", currency: "EUR" },
  { country: "Spain", code: "ES", currency: "EUR" },
  { country: "Netherlands", code: "NL", currency: "EUR" },
  { country: "Belgium", code: "BE", currency: "EUR" },
  { country: "Ireland", code: "IE", currency: "EUR" },
  { country: "Sweden", code: "SE", currency: "SEK" },
  { country: "Poland", code: "PL", currency: "PLN" },
  { country: "Turkey", code: "TR", currency: "TRY" },
  { country: "UAE", code: "AE", currency: "AED" },
  { country: "Saudi Arabia", code: "SA", currency: "SAR" },
  { country: "Australia", code: "AU", currency: "AUD" },
];

// --- Twelve Data exchange rates ---------------------------------------------
// The free plan allows 8 requests a minute, and every currency is one request.
// To stay under it: each currency's daily rates are fetched once for the last
// two years and kept in memory (refreshed at most once a day, and only when a
// newer date is asked for), page loads asking at the same time share one
// request, and requests wait for a free slot instead of failing.
const TWELVE_DATA_PER_MINUTE = 8;
const seriesByQuote = new Map(); // "JPY" -> { fetchedOn: "2026-11-10", closes: [["2026-08-27", 159.34], ...] } oldest first
const seriesInFlight = new Map(); // "JPY" -> Promise of the above, while it's being fetched
let twelveDataCalls = []; // times of recent requests, for the per-minute limit

// Wait until fewer than 8 Twelve Data requests went out in the last minute.
async function waitForTwelveDataSlot() {
  for (;;) {
    const now = Date.now();
    twelveDataCalls = twelveDataCalls.filter((t) => now - t < 60_000);
    if (twelveDataCalls.length < TWELVE_DATA_PER_MINUTE) {
      twelveDataCalls.push(now);
      return;
    }
    // The oldest request in the window turns a minute old at this point.
    await new Promise((resolve) => setTimeout(resolve, 60_000 - (now - twelveDataCalls[0]) + 100));
  }
}

// Two years of daily closes for one currency: how many of it 1 USD buys.
async function fetchSeries(quote) {
  await waitForTwelveDataSlot();
  const start = new Date();
  start.setUTCFullYear(start.getUTCFullYear() - 2);
  const url = new URL("https://api.twelvedata.com/time_series");
  url.searchParams.set("symbol", `USD/${quote}`);
  url.searchParams.set("interval", "1day");
  url.searchParams.set("start_date", start.toISOString().slice(0, 10));
  url.searchParams.set("outputsize", "5000");
  url.searchParams.set("apikey", process.env.TWELVE_DATA_API_KEY);
  const r = await fetch(url);
  const body = await r.json();
  // Twelve Data reports problems (bad key, rate limit) as { status: "error", code, message }.
  if (!r.ok || body.status === "error") {
    throw new Error(`Twelve Data USD/${quote}: ${body.message ?? `HTTP ${r.status}`}`);
  }
  return {
    fetchedOn: new Date().toISOString().slice(0, 10),
    closes: (body.values ?? []).map((v) => [v.datetime.slice(0, 10), Number(v.close)]).reverse(),
  };
}

// A currency's closes from memory, fetching only when we have none yet or
// `lastDay` is newer than what we have (and we haven't already fetched today).
async function getSeries(quote, lastDay) {
  const today = new Date().toISOString().slice(0, 10);
  const cached = seriesByQuote.get(quote);
  const newest = cached?.closes[cached.closes.length - 1]?.[0] ?? "";
  if (cached && (lastDay <= newest || cached.fetchedOn === today)) return cached;
  if (!seriesInFlight.has(quote)) {
    seriesInFlight.set(
      quote,
      fetchSeries(quote)
        .then((s) => {
          seriesByQuote.set(quote, s);
          return s;
        })
        .finally(() => seriesInFlight.delete(quote)),
    );
  }
  try {
    return await seriesInFlight.get(quote);
  } catch (err) {
    if (cached) return cached; // a failed refresh keeps the copy we already have
    throw err;
  }
}

// The last close on or before `day` — FX markets close on weekends and
// holidays, so those days get the previous trading day's rate.
function closeOn(closes, day) {
  let rate = null;
  for (const [d, close] of closes) {
    if (d > day) break;
    rate = close;
  }
  return rate;
}

router.get("/exchange_rates", ...unlessLocalDev(requireAuth, requireActive), async (req, res) => {
  try {
    const days = [...new Set(String(req.query.dates ?? "").split(","))]
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort();
    // Only the currencies asked for (?currencies=JPY,EUR); defaults to all of them.
    const allQuotes = RATE_QUOTES.split(",");
    const quotes = String(req.query.currencies || RATE_QUOTES)
      .split(",")
      .map((q) => q.trim().toUpperCase())
      .filter((q) => allQuotes.includes(q));

    // One currency failing (e.g. Twelve Data down) leaves just that one out.
    const series = {};
    if (days.length) {
      const lastDay = days[days.length - 1];
      const results = await Promise.allSettled(quotes.map((q) => getSeries(q, lastDay)));
      results.forEach((result, i) => {
        if (result.status === "fulfilled") series[quotes[i]] = result.value;
        else console.error("[health/exchange_rates]", result.reason?.message);
      });
    }

    // "2026-08-27" -> { USD: 1, JPY: 159.34, ... } — each currency per 1 USD.
    const rates = Object.fromEntries(
      days.map((day) => {
        const dayRates = { USD: 1 };
        for (const [quote, s] of Object.entries(series)) {
          const rate = closeOn(s.closes, day);
          if (rate != null) dayRates[quote] = rate;
        }
        return [day, dayRates];
      }),
    );

    const wanted = String(req.query.country ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const countries = wanted.length
      ? MARKETPLACE_COUNTRIES.filter((c) => wanted.includes(c.code.toLowerCase()) || wanted.includes(c.country.toLowerCase()))
      : MARKETPLACE_COUNTRIES;
    if (wanted.length && !countries.length) {
      return res.status(400).json({ error: `Unknown country: ${req.query.country}. Use a code (JP) or name (Japan).` });
    }

    const byCountry = Object.fromEntries(
      Object.entries(rates).map(([day, dayRates]) => [
        day,
        countries.map((c) => ({ ...c, rate: dayRates[c.currency] ?? null })),
      ]),
    );
    res.json({ rates, byCountry });
  } catch (err) {
    console.error("[health/exchange_rates]", err.message);
    res.status(502).json({ error: "Failed to load exchange rates" });
  }
});


router.get("/listing-data", ...unlessLocalDev(requireAuth, requireActive, requirePageAccess("product_listings")), async (req, res) => {
  try {

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

with base as (
    select a.*,
		case
		  when a.item_tax is null or a.item_tax = 0 then null
		  else round(((a.item_price - a.item_tax) / (a.item_price - (a.item_price - a.item_tax))), 1)
		end as taxper,		   	a.item_price - a.item_tax					  as Price_wo_tax,
			  Round(abs(a.item_promotion_discount) / (1+ (t.taxper)/100),2) as discount_wo_tax
			   
    from amazon.get_amazon_fulfilled_shipments_data_general a
	cross join lateral (
       select case
		  when a.item_tax is null or a.item_tax = 0 then null
		  else round((a.item_price - a.item_tax) / (a.item_price - (a.item_price - a.item_tax)), 2)
		end as taxper
    ) t
)
 select to_char(a.purchase_date, 'DD/MM/YY') as Purchase_date,
 		a.taxper 		as taxper,
		a.item_promotion_discount as discount,
	    a.discount_wo_tax as discount_wo_tax,
		b.item_code                                   as item_code,
		b.units_per_sku                               as Set_,
		a.quantity_shipped                            as QTY,
		a.item_price                                  as Product_Sale_Price,
		a.item_price - a.item_tax					            as price_wo_tax,
		Round((a.item_price/a.quantity_shipped),2)    as Unit_price,
		a.price_wo_tax - a.discount_wo_tax			      as net_price,
		a.item_tax - ( a.item_promotion_discount - a.discount_wo_tax)   as net_tax,
		a.amazon_order_id                                               as Order_id,
		a.fulfillment_center_id				                                 as fulfillment_center,
		a.sales_channel                         as fulfillment_sale_channel,
    taxper as tax_pre,
		to_char(a.shipment_date, 'DD/MM/YY')          as Shipped_date,
		a.marketplace_id                              as marketplace_id,
		a.sku										  as sku
		from base a
		left join core.item_sku_map b
		on a.sku = b.seller_sku 
		left join (select distinct on (seller_sku) seller_sku,  item_name
		           from amazon.get_merchant_listings_all_data) c
		on a.sku = c.seller_sku
`);
    res.json({ rows });
  } catch (err) {
    console.error("[health/sale_report]", err.message);
    res.status(500).json({ error: "Failed to load shipments from the database" });
  }
});


router.get("/recent_order", ...unlessLocalDev(requireAuth, requireActive, requirePageAccess("dashboard")), async (req, res) => {
  try {
    const { rows } = await query(`
    SELECT 
           COALESCE(p.product_name, a.product_name, '')                           AS item_name,
           a.sku                                                                  AS sku,
           COALESCE(i.item_code, '')                                              AS "dtiItemCode",
           i.units_per_sku                                          AS qty,
           a.item_price                   AS item_price,
           a.marketplace_id                                                       AS marketplace_id
      FROM amazon.get_amazon_fulfilled_shipments_data_general a
      LEFT JOIN core.item_sku_map i
             ON i.seller_sku = a.sku 
      LEFT JOIN core.products p
             ON p.seller_sku = a.sku 
     ORDER BY a.purchase_date DESC NULLS LAST
     LIMIT 100

     `
    );
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
  
SELECT  c.transaction_type                             as category,
        to_char(a.return_date, 'DD/MM/YY')             as return_date,
        c.sku                                          as sku,
        d.item_code                                    as item_code,
        d.units_per_sku                                as set_,
        coalesce(a.quantity, o.quantity)               as qty,
        c.amount                                       as product_refund_price,
        round(c.amount / nullif(coalesce(a.quantity, o.quantity), 0), 2) as unit_price,
        c.order_id                                     as order_id,
        a.detailed_disposition                         as detailed_disposition,
        a.reason                                       as reason,
        a.status                                       as status,
        c.marketplace_name                             as fulfillment,
        to_char(o.purchase_date, 'DD/MM/YY')           as purchase_date,
        c.marketplace_id                               as marketplace_id
FROM amazon.v_settlement_lines c
LEFT JOIN LATERAL (
        select sum(s.quantity_purchased) as quantity, min(s.posted_date::date) as purchase_date
        from amazon.v_settlement_lines s
        where s.order_id = c.order_id and s.sku = c.sku
          and s.transaction_type = 'Order' and s.amount_description = 'Principal'
     ) o ON true

LEFT JOIN LATERAL (
        select max(r.return_date) as return_date, sum(r.quantity) as quantity,
               max(r.detailed_disposition) as detailed_disposition,
               max(r.reason) as reason, max(r.status) as status
        from amazon.get_fba_fulfillment_customer_returns_data r
        where r.order_id = c.order_id and r.sku = c.sku
     ) a ON true
LEFT JOIN core.item_sku_map d ON d.seller_sku = c.sku
WHERE c.transaction_type = 'Refund'
  AND c.amount_description = 'Principal'

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
    console.error("[health/stocks]", err.message);
    res.status(500).json({ error: "Failed to load refunds from the database" });
  }
});

router.get("/tax", ...unlessLocalDev(requireAuth, requireActive), async (req, res) => {
  try {
    const { rows } = await query(`
     select b.sku           as sku,
	   a.item_code            as "dtiItemCode",
	   b.sales_channel        as sale_channel,
	   b.item_tax             as item_tax,
	   b.quantity_shipped     as sold_qty,
	   b.item_price           as item_price,
     b.amazon_order_id      as order_id,
     b.marketplace_id       as marketplace_id
	   from core.item_sku_map  a
	   right join amazon.get_amazon_fulfilled_shipments_data_general b
	   on a.seller_sku = b.sku
    `);
    res.json({ rows });
  } catch (err) {
    console.error("[health/tax]", err.message);
    res.status(500).json({ error: "Failed to load refunds from the database" });
  }
});

export default router;
