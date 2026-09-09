import "dotenv/config";
import admin from "firebase-admin";

// Service-account credentials — the only credential type that can verify ID
// tokens, set custom claims, and do privileged reads/writes. This is NOT the
// same as the client apiKey used in frontend/src/firebase.ts.
const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

const credential = admin.credential.cert({
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey,
});

if (!admin.apps.length) {
  admin.initializeApp({ credential });
}

export const auth = admin.auth();
export default admin;

// --- Realtime Database via REST ------------------------------------------
// The Admin SDK's admin.database() client keeps a persistent socket open,
// which stalls in short-lived serverless functions (Vercel) — the first read
// waits on a WebSocket handshake that often outlives the function. These
// helpers hit the RTDB REST API instead: one stateless HTTPS call per op.
// Behaviour is identical in local dev.

const DB_URL = (process.env.FIREBASE_DATABASE_URL || "").replace(/\/+$/, "");

let cachedToken = null;
let tokenExpiresAt = 0;

async function accessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) return cachedToken;
  const { access_token, expires_in } = await credential.getAccessToken();
  cachedToken = access_token;
  tokenExpiresAt = Date.now() + expires_in * 1000;
  return cachedToken;
}

async function dbRequest(method, path, body) {
  if (!DB_URL) throw new Error("FIREBASE_DATABASE_URL is not set");
  const token = await accessToken();
  const res = await fetch(`${DB_URL}/${path}.json`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`RTDB ${method} /${path} -> ${res.status} ${text}`.trim());
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export const db = {
  /** Returns the value at `path`, or null if it doesn't exist. */
  get: (path) => dbRequest("GET", path),
  /** Replaces the value at `path`. */
  set: (path, value) => dbRequest("PUT", path, value === undefined ? null : value),
  /** Merges `value` into the object at `path`. */
  update: (path, value) => dbRequest("PATCH", path, value),
  /** Deletes the value at `path`. */
  remove: (path) => dbRequest("DELETE", path),
  /** Appends `value` under a generated push id; returns { name }. */
  push: (path, value) => dbRequest("POST", path, value),
};
