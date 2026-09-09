import { db } from "./firebaseAdmin.js";

/**
 * Append one entry to the audit log: who, what action, on what device, when.
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
    });
  } catch (err) {
    console.error("audit log failed:", err.message);
  }
}
