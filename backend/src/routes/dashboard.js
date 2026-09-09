import { Router } from "express";
import { requireAuth, requireActive } from "../middleware/authMiddleware.js";
import {
  product,
  stats,
  revenueTrend,
  salesByFinish,
  variants,
  recentOrders,
} from "../data/sampleData.js";

const router = Router();

// Any approved user (admin or user) can see the overview. Pending/denied 403.
router.get("/overview", requireAuth, requireActive, async (req, res) => {
  res.json({ product, stats, revenueTrend, salesByFinish, variants, recentOrders });
});

export default router;
