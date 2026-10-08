// Local dev entry point. On Vercel the app is served by api/index.js instead.
import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import app from "./app.js";
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// serve the built React site
const distPath = path.join(__dirname, "..", "frontend", "dist");
app.use(express.static(distPath));

// any page that isn't /api → send index.html (so React routing works)
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Server listening on port ${port}`));
