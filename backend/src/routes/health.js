// backend/src/routes/health.js  (ES module)
// GET <mount-path>/db  ->  { ok: true } when Cloud SQL is reachable

import express from "express";
import { query } from "../db.js";
import { requireAuth, requireActive, requireAdmin } from "../middleware/authMiddleware.js";

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
router.get("/orders", requireAuth, requireActive, requireAdmin, async (req, res) => {
  try {
    const result = await query("SELECT * FROM amazon.get_ledger_detail_view_data LIMIT 100");
    res.json(result.rows);
  } catch (err) {
    console.error("[health/orders]", err.message);
    
    res.status(500).json({ error: `Database error: ${err.message}` });
  }
});
export default router;
