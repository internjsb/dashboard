// Local access to Cloud SQL (for pgAdmin / psql / local scripts).
// Starts the Cloud SQL Auth Proxy on 127.0.0.1:5432 using the same
// INSTANCE_CONNECTION_NAME and GOOGLE_CREDENTIALS_JSON as backend/.env, so no
// key file has to be saved to disk. Run: npm run db:proxy   (Ctrl+C to stop)
//
// Needs the cloud-sql-proxy binary (ships with the Google Cloud SDK, or set
// CLOUD_SQL_PROXY_BIN to its path). DB_PORT overrides the local port.
import "dotenv/config";
import { spawn } from "node:child_process";

const bin = process.env.CLOUD_SQL_PROXY_BIN || "cloud-sql-proxy";
const port = process.env.DB_PORT || "5432";

for (const name of ["INSTANCE_CONNECTION_NAME", "GOOGLE_CREDENTIALS_JSON"]) {
  if (!process.env[name]) {
    console.error(`${name} is not set in backend/.env`);
    process.exit(1);
  }
}

const proxy = spawn(
  bin,
  [
    "--json-credentials",
    process.env.GOOGLE_CREDENTIALS_JSON,
    "--address",
    "127.0.0.1",
    "--port",
    port,
    process.env.INSTANCE_CONNECTION_NAME,
  ],
  { stdio: "inherit" },
);

proxy.on("error", (err) => {
  console.error(
    err.code === "ENOENT"
      ? `Couldn't find "${bin}". Install the Google Cloud SDK or set CLOUD_SQL_PROXY_BIN to the proxy's full path.`
      : err.message,
  );
  process.exit(1);
});
proxy.on("exit", (code) => process.exit(code ?? 0));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => proxy.kill(sig));
