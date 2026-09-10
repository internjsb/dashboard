import { Router } from "express";
import { requireAuth, requireActive } from "../middleware/authMiddleware.js";
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
} from "../data/sampleData.js";

const router = Router();

// Any approved user (admin or user) can see the overview.
router.get("/overview", requireAuth, requireActive, async (req, res) => {
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
// and user-base growth.
router.get("/sales-history", requireAuth, requireActive, async (req, res) => {
  res.json(salesHistory);
});

// On-hand inventory per finish and per fulfilment country, with each item
// flagged low/out so the client can surface a notification.
router.get("/stock-available", requireAuth, requireActive, async (req, res) => {
  const byItem = stockAvailable.byItem.map((it) => ({
    ...it,
    status: it.available <= 0 ? "out" : it.available <= it.reorderLevel ? "low" : "ok",
  }));
  res.json({ byItem, byCountry: stockAvailable.byCountry });
});

export default router;
