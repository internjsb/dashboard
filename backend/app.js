import express from "express";
import cors from "cors";
import authRoutes from "./src/routes/auth.js";
import dashboardRoutes from "./src/routes/dashboard.js";

// The Express app with no listener attached, so it can run two ways:
//   - backend/server.js  -> app.listen() for local dev
//   - api/index.js        -> exported as a Vercel serverless function
const app = express();

// On Vercel the frontend and API share an origin, so CORS is a non-issue there.
// It only matters for local dev (Vite :5173 -> API :4000) and any split deploy.
// CLIENT_ORIGIN may be a comma-separated list.
const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`Origin ${origin} not allowed by CORS`));
    },
  })
);
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use("/api", authRoutes);
app.use("/api/dashboard", dashboardRoutes);

// Central error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

export default app;
