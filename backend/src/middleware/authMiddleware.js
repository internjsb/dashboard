import { auth, rtdb } from "../firebaseAdmin.js";

/**
 * Verifies "Authorization: Bearer <idToken>" and attaches req.user = { uid, email, role }.
 * role is "admin" or "user" — read from the token's custom claim first (fast
 * path, set by the seed script or the admin's "promote user" action), falling
 * back to a Realtime Database lookup so role changes are visible even before
 * the client's token has refreshed.
 */
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing bearer token" });
  }

  try {
    const decoded = await auth.verifyIdToken(token);
    let role = decoded.role;

    if (!role) {
      const snap = await rtdb.ref(`users/${decoded.uid}/role`).get();
      role = snap.exists() ? snap.val() : "user";
    }

    req.user = { uid: decoded.uid, email: decoded.email, role };
    next();
  } catch (err) {
    console.error("Token verification failed:", err.message);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Gate a route to admins only. Must run after requireAuth.
export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden — admin only" });
  }
  next();
}
