import { Router } from "express";
import { auth, rtdb } from "../firebaseAdmin.js";
import {
  requireAuth,
  requireAdmin,
  requireSuperAdmin,
  isSuperAdminEmail,
} from "../middleware/authMiddleware.js";

const router = Router();

// Frontend calls this right after login to learn its role + approval status.
// Deliberately NOT gated on "active" — a pending user needs this to know to
// show the "awaiting approval" screen.
router.get("/me", requireAuth, async (req, res) => {
  res.json({
    uid: req.user.uid,
    email: req.user.email,
    role: req.user.role,
    status: req.user.status,
    isSuperAdmin: req.user.isSuperAdmin,
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
    await rtdb.ref(`users/${req.user.uid}/displayName`).set(displayName);
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
    const existing = await rtdb.ref(`users/${uid}`).get();
    if (existing.exists()) {
      const v = existing.val();
      return res.json({ status: v.status || "active", role: v.role || "user" });
    }

    const status = isSuperAdmin ? "active" : "pending";
    const role = isSuperAdmin ? "admin" : "user";

    if (isSuperAdmin) await auth.setCustomUserClaims(uid, { role: "admin" });
    await rtdb.ref(`users/${uid}`).set({ email, displayName, role, status });

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
    const snap = await rtdb.ref("users").get();
    const all = snap.exists() ? snap.val() : {};
    const requests = Object.entries(all)
      .filter(([, v]) => v.status === "pending")
      .map(([uid, v]) => ({ uid, email: v.email, displayName: v.displayName || null }));
    res.json({ requests });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to list requests" });
  }
});

// Approve a pending signup -> grants standard "user" access.
router.post("/requests/:uid/approve", requireAuth, requireAdmin, async (req, res) => {
  const { uid } = req.params;
  try {
    const snap = await rtdb.ref(`users/${uid}`).get();
    if (!snap.exists()) return res.status(404).json({ error: "No such account" });

    await auth.setCustomUserClaims(uid, { role: "user" });
    await auth.updateUser(uid, { disabled: false });
    await rtdb.ref(`users/${uid}`).update({ role: "user", status: "active" });
    res.json({ uid, role: "user", status: "active" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to approve" });
  }
});

// Deny a pending signup -> disables the login.
router.post("/requests/:uid/deny", requireAuth, requireAdmin, async (req, res) => {
  const { uid } = req.params;
  try {
    const snap = await rtdb.ref(`users/${uid}`).get();
    if (!snap.exists()) return res.status(404).json({ error: "No such account" });

    await auth.updateUser(uid, { disabled: true });
    await rtdb.ref(`users/${uid}`).update({ status: "denied" });
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
    const [authUsers, roleSnap] = await Promise.all([
      auth.listUsers(1000),
      rtdb.ref("users").get(),
    ]);
    const records = roleSnap.exists() ? roleSnap.val() : {};

    const users = authUsers.users.map((u) => ({
      uid: u.uid,
      email: u.email,
      displayName: u.displayName || records[u.uid]?.displayName || null,
      role: records[u.uid]?.role || "user",
      status: records[u.uid]?.status || "active",
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

// SUPER ADMIN ONLY: promote/demote between "admin" and "user".
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
    await rtdb.ref(`users/${uid}/role`).set(role);
    res.json({ uid, role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update role" });
  }
});

export default router;
