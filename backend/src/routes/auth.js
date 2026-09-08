import { Router } from "express";
import { auth, rtdb } from "../firebaseAdmin.js";
import { requireAuth, requireAdmin } from "../middleware/authMiddleware.js";

const router = Router();

// Frontend calls this right after login to know the user's role.
router.get("/me", requireAuth, async (req, res) => {
  res.json({ uid: req.user.uid, email: req.user.email, role: req.user.role });
});

// Admin-only: list every user with their current role.
router.get("/users", requireAuth, requireAdmin, async (req, res) => {
  try {
    const [authUsers, roleSnap] = await Promise.all([
      auth.listUsers(1000),
      rtdb.ref("users").get(),
    ]);
    const roles = roleSnap.exists() ? roleSnap.val() : {};

    const users = authUsers.users.map((u) => ({
      uid: u.uid,
      email: u.email,
      displayName: u.displayName || null,
      role: roles[u.uid]?.role || "user",
      disabled: u.disabled,
      createdAt: u.metadata.creationTime,
    }));

    res.json({ users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to list users" });
  }
});

// Admin-only: promote/demote a user. The one super admin is the only person
// who can call this — enforced by requireAdmin, not by anything in the UI.
router.patch("/users/:uid/role", requireAuth, requireAdmin, async (req, res) => {
  const { uid } = req.params;
  const { role } = req.body;

  if (!["admin", "user"].includes(role)) {
    return res.status(400).json({ error: 'role must be "admin" or "user"' });
  }
  if (uid === req.user.uid) {
    return res.status(400).json({ error: "You can't change your own role" });
  }

  try {
    await auth.setCustomUserClaims(uid, { role });
    await rtdb.ref(`users/${uid}/role`).set(role);
    res.json({ uid, role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update role" });
  }
});

export default router;
