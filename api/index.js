// Vercel serverless function. Every /api/* request is routed here (see
// vercel.json) and handled by the shared Express app. Env vars come from the
// Vercel project settings, not a .env file.
import app from "../backend/app.js";

export default app;
