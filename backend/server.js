// Local dev entry point. On Vercel the app is served by api/index.js instead.
import "dotenv/config";
import app from "./app.js";

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
