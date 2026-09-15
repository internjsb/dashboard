import { Router } from "express";
import { requireAuth, requireActive, requirePageAccess } from "../middleware/authMiddleware.js";
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
// flagged low/out so the client can surface a notification. Admins,
// "super_user", and "supplychain".
router.get("/stock-available", requireAuth, requireActive, requirePageAccess("stock_available"), async (req, res) => {
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
});

// Transactions, taxes, and generated finance reports. Admins, "super_user",
// and "finance".
router.get("/finance", requireAuth, requireActive, requirePageAccess("finance"), async (req, res) => {
  res.json(finance);
});

export default router;
