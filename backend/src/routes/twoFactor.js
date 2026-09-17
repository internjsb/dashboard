import { Router } from "express";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { db } from "../firebaseAdmin.js";
import { audit } from "../audit.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = Router();
const ISSUER = "Amazon Dashboard";


router.post("/setup", requireAuth, async (req, res) => {
  try {
    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(req.user.email, ISSUER, secret);
    const qrCode = await QRCode.toDataURL(otpauth);

    await db.update(`users/${req.user.uid}/twoFactor`, { secret, enabled: false });

    res.json({ qrCode, secret });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to start 2FA setup" });
  }
});

// Confirms the 6-digit code from the authenticator app matches the secret
// issued by /setup, then flips 2FA on for this account.
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
    await audit(req, "user.2fa_enable", {});
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to verify code" });
  }
});

export default router;
