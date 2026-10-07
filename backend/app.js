import express from "express";
import cors from "cors";
import authRoutes from "./src/routes/auth.js";
import dashboardRoutes from "./src/routes/dashboard.js";
import twoFactorRoutes from "./src/routes/twoFactor.js";
import healthRoutes from "./src/routes/health.js"; //to test the gloud sql connectivity

// The Express app with no listener attached, so it can run two ways:
//   - backend/server.js  -> app.listen() for local dev
//   - api/index.js        -> exported as a Vercel serverless function
const app = express();

// Heroku (and Vercel) sit one proxy hop in front of the app. Trusting exactly
// that one hop makes req.ip the real client address (used by the audit log's
// IP + location) while ignoring any X-Forwarded-For a client tries to forge.
app.set("trust proxy", 1);

// CORS only matters for cross-origin calls (local dev: Vite :5173 -> API :4000,
// or a split deploy). On Vercel the frontend and API share an origin, so no
// CORS headers are needed there. CLIENT_ORIGIN may be a comma-separated list of
// extra allowed origins. For anything not allowed we simply DON'T send CORS
// headers (cb(null, false)) — never throw, or same-origin POSTs (which still
// carry an Origin header) would 500.
const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors((req, cb) => {
    const origin = req.headers.origin;
    let sameOrigin = false;
    try {
      sameOrigin = !!origin && new URL(origin).host === req.headers.host;
    } catch {
      /* malformed Origin header */
    }
    const ok = !origin || sameOrigin || allowedOrigins.includes(origin);
    cb(null, { origin: ok });
  })
);
app.use(express.json());
app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use("/api", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/2fa", twoFactorRoutes);
app.use("/api/health", healthRoutes);   // ← add: GET /api/health/db tests Cloud SQL

// Central error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

export default app;
