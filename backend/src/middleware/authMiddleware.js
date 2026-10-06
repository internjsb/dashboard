import { auth, db } from "../firebaseAdmin.js";

const SUPER_ADMIN_EMAIL = (process.env.SUPER_ADMIN_EMAIL || "").toLowerCase().trim();

/** Is this email THE permanent super admin? (case-insensitive) */
export function isSuperAdminEmail(email) {
  return !!SUPER_ADMIN_EMAIL && (email || "").toLowerCase().trim() === SUPER_ADMIN_EMAIL;
}

/**
 * Verifies "Authorization: Bearer <idToken>" and attaches
 * req.user = { uid, email, role, status, department, pageAccess, isSuperAdmin }.
 *
 * - role       — "admin" | "user", from the token claim, falling back to the RTDB mirror.
 * - status     — "pending" | "active" | "denied". New self-registered accounts start
 *                "pending" and get no access until an admin approves them. Records that
 *                predate the approval system (no status field) are treated as "active".
 * - department — "super_user" | "sales" | "supplychain" | "finance" | null. Purely an
 *                informational tag now (who's on which team) — it no longer drives page
 *                access on its own.
 * - pageAccess — { [pageKey]: true }, set per-user from the "Page management" admin
 *                screen. Drives which pages a non-admin can see (see requirePageAccess
 *                below).
 * - The super admin (matched by email) is always role "admin" + status "active",
 *   regardless of what the token or database say.
 */
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing bearer token" });
  }

  try {
    const decoded = await auth.verifyIdToken(token);

    // The token can still be valid for up to an hour after an admin deletes the
    // account. Confirm the Firebase user is still there so a removed user is
    // logged out with a clear reason instead of silently losing access.
    try {
      const authUser = await auth.getUser(decoded.uid);
      if (authUser.disabled) {
        return res.status(401).json({ error: "This account has been disabled", code: "account_disabled" });
      }
    } catch (lookupErr) {
      if (lookupErr.code === "auth/user-not-found") {
        return res.status(401).json({ error: "This account has been removed", code: "account_removed" });
      }
      throw lookupErr;
    }

    const record = await db.get(`users/${decoded.uid}`);

    const superAdmin = isSuperAdminEmail(decoded.email);
    let role = decoded.role || record?.role || "user";
    let status = record ? record.status || "active" : "pending";

    if (superAdmin) {
      role = "admin";
      status = "active";
    }

    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      role,
      status,
      department: record?.department || null,
      pageAccess: record?.pageAccess || {},
      isSuperAdmin: superAdmin,
      twoFactorEnabled: !!record?.twoFactor?.enabled,
    };
    next();
  } catch (err) {
    console.error("Token verification failed:", err.message);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Gate a route to approved accounts. Must run after requireAuth.
export function requireActive(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  if (req.user.status !== "active") {
    return res.status(403).json({ error: "Account is not approved yet", status: req.user.status });
  }
  next();
}

// Gate a route to admins (includes the super admin). Must run after requireAuth.
export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden — admin only" });
  }
  next();
}

// Gate a route to the one super admin. Must run after requireAuth.
export function requireSuperAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  if (!req.user.isSuperAdmin) {
    return res.status(403).json({ error: "Forbidden — super admin only" });
  }
  next();
}

// Gate a route to users with a per-user grant for `page` (or `page` being an
// array — passes if ANY of them is granted; some endpoints back more than
// one frontend page). Only the one true super admin bypasses this. Being
// "admin" role does NOT grant blanket access on its own — a promoted admin
// sees only whatever's checked for them on the Page management screen, same
// as anyone else (Manage users / Audit log / Page management stay gated on
// role, not per-page grants). Must run after requireAuth (and typically
// requireActive).
export function requirePageAccess(page) {
  const pages = Array.isArray(page) ? page : [page];
  return function (req, res, next) {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    if (req.user.isSuperAdmin) return next();
    if (pages.some((p) => req.user.pageAccess?.[p])) return next();
    return res.status(403).json({ error: "You don't have access to this page" });
  };
}
