import { Router } from "express";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { db } from "../firebaseAdmin.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = Router();
const ISSUER = "Amazon Dashboard";


router.post("/setup", requireAuth, async (req, res) => {
  try {
    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(req.user.email, ISSUER, secret);
    const qrCode = await QRCode.toDataURL(otpauth);
    const existing = await db.get(`users/${req.user.uid}/twoFactor`);

    if (existing?.enabled) {
    return res.status(400).json({ error: "2FA is already set up for this account" });
    }

    await db.update(`users/${req.user.uid}/twoFactor`, { secret, enabled: false });

    res.json({ qrCode, secret });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to start 2FA setup" });
  }
});

router.get("/status", requireAuth, async (req, res) => {
  try {
    const record = await db.get(`users/${req.user.uid}/twoFactor`);
    res.json({ enabled: !!record?.enabled });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to check 2FA status" });
  }
});

// Lets a signed-in user who's locked out of their authenticator start over:
// clears "enabled" so /setup will issue a fresh secret + QR instead of
// bouncing with "2FA is already set up for this account".
router.post("/reset", requireAuth, async (req, res) => {
  try {
    await db.update(`users/${req.user.uid}/twoFactor`, { enabled: false });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to reset 2FA" });
  }
});

router.post("/verify", requireAuth, async (req, res) => {
  const token = (req.body?.token || "").trim();
  if (!token) {
    return res.status(400).json({ error: "Enter the 6-digit code" });
  }

  try {
    const record = await db.get(`users/${req.user.uid}/twoFactor`);
    if (!record?.secret) {
      return res.status(400).json({ error: "Start 2FA setup first" });
    }

    const valid = authenticator.verify({ token, secret: record.secret });
    if (!valid) {
      return res.status(400).json({ error: "Incorrect or expired code" });
    }

    await db.update(`users/${req.user.uid}/twoFactor`, { enabled: true });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to verify code" });
  }
});

export default router;
