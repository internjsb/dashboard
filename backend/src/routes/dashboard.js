import { Router } from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import { stats, revenueTrend, recentActivity } from "../data/sampleData.js";

const router = Router();

// Any authenticated user (admin or user) can see the overview.
router.get("/overview", requireAuth, async (req, res) => {
  res.json({ stats, revenueTrend, recentActivity });
});

export default router;
