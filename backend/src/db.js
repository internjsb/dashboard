// backend/src/db.js  (ES module)
// Connects the Heroku backend to Cloud SQL for PostgreSQL using the
// Cloud SQL Node.js Connector (IAM-authorized, TLS-encrypted, no IP allowlist).
//
// Required Heroku config vars:
//   GOOGLE_CREDENTIALS_JSON   full JSON of the heroku-portal service account key
//   INSTANCE_CONNECTION_NAME  <PROJECT_ID>:us-central1:<INSTANCE_NAME>
//   DB_USER / DB_PASS / DB_NAME
// Optional:
//   DB_POOL_MAX               max connections per dyno (default 5)

import { Connector, IpAddressTypes } from "@google-cloud/cloud-sql-connector";
import { GoogleAuth } from "google-auth-library";
import pg from "pg"; // pg is CommonJS: import the default, then destructure

const { Pool } = pg;

const REQUIRED_VARS = [
  "GOOGLE_CREDENTIALS_JSON",
  "INSTANCE_CONNECTION_NAME",
  "DB_USER",
  "DB_PASS",
  "DB_NAME",
];

let connector;    // Cloud SQL connector (one per process)
let poolPromise;  // lazily created pg Pool, shared across requests

function readCredentials() {
  try {
    return JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
  } catch {
    // Never log the variable itself: it contains a private key.
    throw new Error("GOOGLE_CREDENTIALS_JSON is not valid JSON");
  }
}

async function createPool() {
  const missing = REQUIRED_VARS.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(`Missing config vars: ${missing.join(", ")}`);
  }

  // Authenticate with the key held in a config var (Heroku's disk is ephemeral).
  const auth = new GoogleAuth({
    credentials: readCredentials(),
    scopes: ["https://www.googleapis.com/auth/sqlservice.admin"],
  });

  connector = new Connector({ auth });

  // Socket factory + TLS settings that pg uses to open connections.
  const clientOpts = await connector.getOptions({
    instanceConnectionName: process.env.INSTANCE_CONNECTION_NAME,
    ipType: IpAddressTypes.PUBLIC,
  });

  const pool = new Pool({
    ...clientOpts,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    // Total connections = dynos x max. Keep under Cloud SQL max_connections,
    // leaving room for the Cloud Functions sync jobs.
    max: Number(process.env.DB_POOL_MAX || 5),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  // A dropped idle connection (e.g. Cloud SQL maintenance) must not crash the dyno.
  pool.on("error", (err) => console.error("[db] idle client error:", err.message));

  return pool;
}

// Lazy singleton; resets on failure so the next request retries.
function getPool() {
  if (!poolPromise) {
    poolPromise = createPool().catch((err) => {
      poolPromise = undefined;
      throw err;
    });
  }
  return poolPromise;
}

// Always parameterize: query("SELECT ... WHERE id = $1", [id])
export async function query(text, params) {
  const pool = await getPool();
  return pool.query(text, params);
}

// For transactions: const client = await getClient(); try {...} finally { client.release(); }
export async function getClient() {
  const pool = await getPool();
  return pool.connect();
}

export async function closeDb() {
  if (poolPromise) {
    const pool = await poolPromise.catch(() => null);
    if (pool) await pool.end();
    poolPromise = undefined;
  }
  if (connector) {
    connector.close();
    connector = undefined;
  }
}

export default { query, getClient, closeDb };
