import { Router } from "express";
import { auth, db } from "../firebaseAdmin.js";
import { audit } from "../audit.js";
import {
  requireAuth,
  requireAdmin,
  requireSuperAdmin,
  isSuperAdminEmail,
} from "../middleware/authMiddleware.js";

const router = Router();

// Department tag — separate from the admin/user access-control role. Purely
// informational for now (who's on which team), editable by any admin.
const DEPARTMENTS = ["super_user", "sales", "supplychain", "finance"];

// Business pages a user can be individually granted access to from the
// "Page management" admin screen — see requirePageAccess in authMiddleware.js.
const PAGES = [
  "dashboard",
  "sales_history",
  "sale_report",
  "stock_available",
  "inventory",
  "finance",
  "products",
  "product_listings",
];

// Every page checked — only the "super_user" department defaults to this.
const ALL_PAGE_ACCESS = Object.fromEntries(PAGES.map((p) => [p, true]));

// Starting point only — approving a user into a department (or promoting them
// to admin) pre-checks the pages that obviously need, so they're not stuck
// with zero access until an admin separately visits Page management. Still
// fully editable per-user afterward from that screen; this is just the default.
const DEFAULT_PAGE_ACCESS = {
  sales: { dashboard: true, sales_history: true, sale_report: true },
  supplychain: { stock_available: true, inventory: true, products: true , product_listings: true},
  finance: { finance: true },
  super_user: ALL_PAGE_ACCESS,
};

// The client pings this right after a successful sign-in so the audit log
// records who logged in, from where, and on what device.
router.post("/events/login", requireAuth, async (req, res) => {
  await audit(req, "auth.login", { method: "password" });
  res.json({ ok: true });
});

// Admin + super admin only: the audit log, newest first.
router.get("/audit", requireAuth, requireAdmin, async (req, res) => {
  try {
    const all = (await db.get("audit")) || {};
    const events = Object.entries(all)
      .map(([id, e]) => ({ id, ...e }))
      .sort((a, b) => (b.at || 0) - (a.at || 0))
      .slice(0, 300);
    res.json({ events });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load the audit log" });
  }
});

// Frontend calls this right after login to learn its role + approval status.
// Deliberately NOT gated on "active" — a pending user needs this to know to
// show the "awaiting approval" screen.
router.get("/me", requireAuth, async (req, res) => {
  res.json({
    uid: req.user.uid,
    email: req.user.email,
    role: req.user.role,
    status: req.user.status,
    department: req.user.department,
    pageAccess: req.user.pageAccess,
    isSuperAdmin: req.user.isSuperAdmin,
    twoFactorEnabled: req.user.twoFactorEnabled,
  });
});

// Update the signed-in user's own profile (display name for now). Keeps the
// Firebase Auth record and the RTDB mirror in sync so the admin list shows
// the new name too. Does not touch role or status.
router.patch("/me", requireAuth, async (req, res) => {
  const raw = typeof req.body?.displayName === "string" ? req.body.displayName.trim() : "";
  const displayName = raw || null;

  if (raw.length > 80) {
    return res.status(400).json({ error: "Name is too long (80 characters max)" });
  }

  try {
    await auth.updateUser(req.user.uid, { displayName });
    await db.set(`users/${req.user.uid}/displayName`, displayName);
    await audit(req, "profile.update", { displayName });
    res.json({ displayName });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// Called by the client immediately after it creates a Firebase Auth account.
// The browser can't touch /users (RTDB rules forbid it), so the backend writes
// the mirror record — in a "pending" state. The account exists but has no
// dashboard access until an admin approves it. The super admin is auto-approved.
router.post("/register", requireAuth, async (req, res) => {
  const { uid, email, isSuperAdmin } = req.user;
  const displayName = (req.body?.displayName || "").trim() || null;

  try {
    const existing = await db.get(`users/${uid}`);
    if (existing) {
      return res.json({ status: existing.status || "active", role: existing.role || "user" });
    }

    const status = isSuperAdmin ? "active" : "pending";
    const role = isSuperAdmin ? "admin" : "user";

    if (isSuperAdmin) await auth.setCustomUserClaims(uid, { role: "admin" });
    await db.set(`users/${uid}`, { email, displayName, role, status });
    await audit(req, "auth.signup", { email, status });

    res.status(201).json({ status, role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to provision new account" });
  }
});

// --- Signup approval queue (any admin) -------------------------------------

// List accounts still waiting for approval.
router.get("/requests", requireAuth, requireAdmin, async (req, res) => {
  try {
    const all = (await db.get("users")) || {};
    const requests = Object.entries(all)
      .filter(([, v]) => v.status === "pending")
      .map(([uid, v]) => ({
        uid,
        email: v.email,
        displayName: v.displayName || null,
        department: v.department || null,
      }));
    res.json({ requests });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to list requests" });
  }
});

async function authUserExists(uid) {
  try {
    await auth.getUser(uid);
    return true;
  } catch {
    return false;
  }
}

// Approve a pending signup -> grants standard "user" access and pre-checks
// that department's default pages (see DEFAULT_PAGE_ACCESS) so they aren't
// stuck with zero access until someone visits Page management. The approving
// admin must tag the new account with a department in the same request —
// there's no "approve now, assign later" path.
router.post("/requests/:uid/approve", requireAuth, requireAdmin, async (req, res) => {
  const { uid } = req.params;
  const department = req.body?.department;
  if (!DEPARTMENTS.includes(department)) {
    return res.status(400).json({ error: "Choose a department before approving" });
  }

  try {
    const record = await db.get(`users/${uid}`);
    if (!record) return res.status(404).json({ error: "No such account" });

    if (!(await authUserExists(uid))) {
      // Firebase account was deleted — drop the orphaned record.
      await db.remove(`users/${uid}`);
      await audit(req, "user.remove_orphan", { targetUid: uid, email: record.email });
      return res.status(410).json({ error: "That Firebase account no longer exists — request removed" });
    }

    const pageAccess = DEFAULT_PAGE_ACCESS[department] || {};

    await auth.setCustomUserClaims(uid, { role: "user" });
    await auth.updateUser(uid, { disabled: false });
    await db.update(`users/${uid}`, { role: "user", status: "active", department, pageAccess });
    await audit(req, "user.approve", { targetUid: uid, email: record.email, department, pageAccess });
    res.json({ uid, role: "user", status: "active", department, pageAccess });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to approve" });
  }
});

// Deny a pending signup -> disables the login (or removes an orphaned record
// whose Firebase account has already been deleted).
router.post("/requests/:uid/deny", requireAuth, requireAdmin, async (req, res) => {
  const { uid } = req.params;
  try {
    const record = await db.get(`users/${uid}`);
    if (!record) return res.status(404).json({ error: "No such account" });

    if (!(await authUserExists(uid))) {
      await db.remove(`users/${uid}`);
      await audit(req, "user.remove_orphan", { targetUid: uid, email: record.email });
      return res.json({ uid, status: "removed" });
    }

    await auth.updateUser(uid, { disabled: true });
    await db.update(`users/${uid}`, { status: "denied" });
    await audit(req, "user.deny", { targetUid: uid, email: record.email });
    res.json({ uid, status: "denied" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to deny" });
  }
});

// --- User list + role management -----------------------------------------

// Any admin: list every user with role + status.
router.get("/users", requireAuth, requireAdmin, async (req, res) => {
  try {
    const [authUsers, records] = await Promise.all([
      auth.listUsers(1000),
      db.get("users").then((v) => v || {}),
    ]);

    const users = authUsers.users.map((u) => ({
      uid: u.uid,
      email: u.email,
      displayName: u.displayName || records[u.uid]?.displayName || null,
      role: records[u.uid]?.role || "user",
      status: records[u.uid]?.status || "active",
      department: records[u.uid]?.department || null,
      pageAccess: records[u.uid]?.pageAccess || {},
      isSuperAdmin: isSuperAdminEmail(u.email),
      disabled: u.disabled,
      createdAt: u.metadata.creationTime,
    }));

    res.json({ users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to list users" });
  }
});

// SUPER ADMIN ONLY: promote/demote between "admin" and "user". Being admin
// only adds the role-gated admin pages (Manage users / Audit log / Page
// management) — it does NOT grant every business page. Promoting resets their
// page grants to their department's defaults (e.g. a finance admin gets the
// admin pages + Finance). Demoting back to "user" leaves their existing page
// grants as-is; it doesn't strip access.
// The super admin's own role is locked and can't be targeted.
router.patch("/users/:uid/role", requireAuth, requireSuperAdmin, async (req, res) => {
  const { uid } = req.params;
  const { role } = req.body;

  if (!["admin", "user"].includes(role)) {
    return res.status(400).json({ error: 'role must be "admin" or "user"' });
  }
  if (uid === req.user.uid) {
    return res.status(400).json({ error: "You can't change your own role" });
  }

  try {
    const target = await auth.getUser(uid);
    if (isSuperAdminEmail(target.email)) {
      return res.status(403).json({ error: "The super admin's role is locked" });
    }

    await auth.setCustomUserClaims(uid, { role });
    await db.set(`users/${uid}/role`, role);
    if (role === "admin") {
      const department = (await db.get(`users/${uid}/department`)) || null;
      await db.set(`users/${uid}/pageAccess`, DEFAULT_PAGE_ACCESS[department] || {});
    }
    await audit(req, "user.role_change", { targetUid: uid, email: target.email, role });
    res.json({ uid, role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update role" });
  }
});

// Any admin: assign or clear a user's department tag. Resets that user's
// Page management grants to the new department's defaults (see
// DEFAULT_PAGE_ACCESS) — the Page management screen always starts from
// whatever's set here, then an admin can still fine-tune individual pages
// from that screen afterward. Pass department: null (or omit it) to unassign
// (clears all page grants too).
router.patch("/users/:uid/department", requireAuth, requireAdmin, async (req, res) => {
  const { uid } = req.params;
  const rawDept = req.body?.department;
  if (rawDept != null && !DEPARTMENTS.includes(rawDept)) {
    return res.status(400).json({ error: "Invalid department" });
  }
  const department = rawDept || null;

  if (uid === req.user.uid) {
    return res.status(400).json({ error: "You can't assign your own department" });
  }

  try {
    const target = await auth.getUser(uid);
    if (isSuperAdminEmail(target.email)) {
      return res.status(403).json({ error: "The super admin doesn't need a department" });
    }

    const pageAccess = DEFAULT_PAGE_ACCESS[department] || {};

    await db.update(`users/${uid}`, { department, pageAccess });
    await audit(req, "user.department_change", { targetUid: uid, email: target.email, department, pageAccess });
    res.json({ uid, department, pageAccess });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update department" });
  }
});

// Any admin: grant or revoke one page for one user — the "Page management"
// screen's checkbox grid calls this once per click. The super admin always
// has every page (see requirePageAccess) and can't be targeted; you also
// can't edit your own grants, so an admin can't accidentally lock themself
// out.
router.patch("/users/:uid/page-access", requireAuth, requireAdmin, async (req, res) => {
  const { uid } = req.params;
  const { page, allowed } = req.body || {};

  if (!PAGES.includes(page)) {
    return res.status(400).json({ error: "Unknown page" });
  }
  if (typeof allowed !== "boolean") {
    return res.status(400).json({ error: "allowed must be true or false" });
  }
  if (uid === req.user.uid) {
    return res.status(400).json({ error: "You can't change your own page access" });
  }

  try {
    const target = await auth.getUser(uid);
    if (isSuperAdminEmail(target.email)) {
      return res.status(403).json({ error: "The super admin already has access to every page" });
    }

    await db.set(`users/${uid}/pageAccess/${page}`, allowed);
    await audit(req, "user.page_access_change", { targetUid: uid, email: target.email, page, allowed });
    res.json({ uid, page, allowed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update page access" });
  }
});

// Any admin: disable (suspend) or re-enable an account. A disabled user keeps
// their record but can't sign in. The super admin and your own account can't be
// targeted.
router.patch("/users/:uid/disabled", requireAuth, requireAdmin, async (req, res) => {
  const { uid } = req.params;
  const disabled = req.body?.disabled === true;

  if (uid === req.user.uid) {
    return res.status(400).json({ error: "You can't disable your own account" });
  }

  try {
    const target = await auth.getUser(uid);
    if (isSuperAdminEmail(target.email)) {
      return res.status(403).json({ error: "The super admin can't be disabled" });
    }

    await auth.updateUser(uid, { disabled });
    await db.update(`users/${uid}`, { status: disabled ? "disabled" : "active" });
    await audit(req, disabled ? "user.disable" : "user.enable", {
      targetUid: uid,
      email: target.email,
    });
    res.json({ uid, disabled, status: disabled ? "disabled" : "active" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update account" });
  }
});

// Any admin: permanently delete a user — the Firebase Auth account and the RTDB
// mirror record. The super admin can't be removed, nor can you remove yourself.
router.delete("/users/:uid", requireAuth, requireAdmin, async (req, res) => {
  const { uid } = req.params;

  if (uid === req.user.uid) {
    return res.status(400).json({ error: "You can't remove your own account" });
  }

  try {
    let email = null;
    try {
      const target = await auth.getUser(uid);
      email = target.email;
      if (isSuperAdminEmail(target.email)) {
        return res.status(403).json({ error: "The super admin can't be removed" });
      }
      await auth.deleteUser(uid);
    } catch (err) {
      if (err?.code !== "auth/user-not-found") throw err;
      // Auth account already gone — fall through and clean up the record.
    }

    await db.remove(`users/${uid}`);
    await audit(req, "user.remove", { targetUid: uid, email });
    res.json({ uid, removed: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to remove user" });
  }
});

export default router;
