import geoip from "geoip-lite";
import { db } from "./firebaseAdmin.js";

/** Client IP for this request ("::ffff:1.2.3.4" -> "1.2.3.4"). Needs app "trust proxy". */
export function clientIp(req) {
  const ip = req.ip || req.socket?.remoteAddress || "";
  return ip.startsWith("::ffff:") ? ip.slice(7) : ip;
}

/**
 * Approximate location from the bundled offline GeoIP database — no outside
 * service is called. City is often blank; local/private addresses (dev,
 * office LAN) return { local: true }.
 */
export function locate(ip) {
  if (!ip) return null;
  if (/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd|fe80)/i.test(ip)) return { local: true };
  const hit = geoip.lookup(ip);
  if (!hit) return null;
  return { city: hit.city || null, region: hit.region || null, country: hit.country || null };
}

/**
 * Append one entry to the audit log: who, what action, on what device, from
 * which IP / approximate location, when.
 * Best-effort — a logging failure must never break the request it's recording.
 * Call AFTER requireAuth so req.user is set.
 */
export async function audit(req, action, detail = {}) {
  try {
    await db.push("audit", {
      at: Date.now(),
      actorUid: req.user?.uid ?? null,
      actorEmail: req.user?.email ?? null,
      action,
      detail,
      userAgent: req.headers["user-agent"] || "unknown",
      ip: clientIp(req) || null,
      location: locate(clientIp(req)),
    });
  } catch (err) {
    console.error("audit log failed:", err.message);
  }
}
