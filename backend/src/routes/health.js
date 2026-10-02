// backend/src/routes/health.js  (ES module)
// GET <mount-path>/db  ->  { ok: true } when Cloud SQL is reachable

import express from "express";
import { query } from "../db.js";

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

export default router;
