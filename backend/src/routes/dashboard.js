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

export default router;
