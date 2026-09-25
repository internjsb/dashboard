import { useState, type FormEvent } from "react";
import axios from "axios";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import AppSidebar from "../components/AppSidebar";
import AppTopbar from "../components/AppTopbar";
import PasswordField from "../components/PasswordField";
import api from "../api/client";
import { auth } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { PASSWORD_RULE_TEXT, passwordError } from "../utils/passwordPolicy";
import styles from "./Profile.module.css";

function apiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string } | undefined;
    return data?.error || fallback;
  }
  return fallback;
}

interface TwoFASetupResponse {
  qrCode?: string;
  secret?: string;
}

export default function Profile() {
  const {
    user,
    displayName,
    role,
    isSuperAdmin,
    refreshProfile,
    twoFactorEnabled,
    markTwoFactorVerified,
    markTwoFactorDisabled,
  } = useAuth();

  const email = user?.email ?? "";
  const initials = (displayName || email || "?").slice(0, 2).toUpperCase();
  const hasPasswordLogin = user?.providerData.some((p) => p.providerId === "password") ?? false;
  const memberSince = user?.metadata.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";

  // --- display name ---------------------------------------------------
  const [name, setName] = useState(displayName ?? "");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function saveName(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNameMsg(null);
    setNameSaving(true);
    try {
      await api.patch("/me", { displayName: name.trim() });
      await refreshProfile();
      setNameMsg({ ok: true, text: "Name updated." });
    } catch (err) {
      setNameMsg({ ok: false, text: apiError(err, "Couldn't update your name.") });
    } finally {
      setNameSaving(false);
    }
  }

  // --- password ------------------------------------------------------
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function savePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPwMsg(null);

    if (next !== confirm) {
      setPwMsg({ ok: false, text: "New passwords don't match." });
      return;
    }
    if (!auth.currentUser || !email) return;

    setPwSaving(true);

    const pwIssue = await passwordError(next);
    if (pwIssue) {
      setPwMsg({ ok: false, text: pwIssue });
      setPwSaving(false);
      return;
    }

    try {
      const cred = EmailAuthProvider.credential(email, current);
      await reauthenticateWithCredential(auth.currentUser, cred);
      await updatePassword(auth.currentUser, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      setPwMsg({ ok: true, text: "Password changed." });
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : undefined;
      setPwMsg({ ok: false, text: mapPwError(code) });
    } finally {
      setPwSaving(false);
    }
  }

  function mapPwError(code?: string): string {
    switch (code) {
      case "auth/wrong-password":
      case "auth/invalid-credential":
        return "Current password is incorrect.";
      case "auth/weak-password":
        return `New password is too weak — ${PASSWORD_RULE_TEXT.toLowerCase()}`;
      case "auth/too-many-requests":
        return "Too many attempts. Try again in a moment.";
      case "auth/requires-recent-login":
        return "Please sign out and back in, then try again.";
      default:
        return "Couldn't change your password.";
    }
  }

  // --- two-factor authentication --------------------------------------
  const [twoFaMsg, setTwoFaMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [showEnable2FA, setShowEnable2FA] = useState(false);
  const [setupData, setSetupData] = useState<TwoFASetupResponse | null>(null);
  const [setupCode, setSetupCode] = useState("");
  const [setupSaving, setSetupSaving] = useState(false);
  const [setupMsg, setSetupMsg] = useState<string | null>(null);

  const [showDisable2FA, setShowDisable2FA] = useState(false);
  const [disableCode, setDisableCode] = useState("");
  const [disableSaving, setDisableSaving] = useState(false);
  const [disableMsg, setDisableMsg] = useState<string | null>(null);

  async function startEnable2FA() {
    setTwoFaMsg(null);
    setSetupMsg(null);
    setSetupCode("");
    setShowEnable2FA(true);
    setSetupData(null);
    try {
      const { data } = await api.post<TwoFASetupResponse>("/2fa/setup");
      setSetupData(data);
    } catch (err) {
      setSetupMsg(apiError(err, "Couldn't start 2FA setup."));
    }
  }

  function cancelEnable2FA() {
    setShowEnable2FA(false);
    setSetupData(null);
    setSetupCode("");
    setSetupMsg(null);
  }

  async function handleVerifyEnable(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSetupMsg(null);
    if (!setupCode.trim()) {
      setSetupMsg("Enter the 6-digit code.");
      return;
    }
    setSetupSaving(true);
    try {
      await api.post("/2fa/verify", { token: setupCode.trim() });
      markTwoFactorVerified();
      cancelEnable2FA();
      setTwoFaMsg({ ok: true, text: "Two-factor authentication is on." });
    } catch (err) {
      setSetupMsg(apiError(err, "Couldn't verify that code."));
    } finally {
      setSetupSaving(false);
    }
  }

  function cancelDisable2FA() {
    setShowDisable2FA(false);
    setDisableCode("");
    setDisableMsg(null);
  }

  async function handleDisable(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setDisableMsg(null);
    if (!disableCode.trim()) {
      setDisableMsg("Enter your current 6-digit code.");
      return;
    }
    setDisableSaving(true);
    try {
      await api.post("/2fa/disable", { token: disableCode.trim() });
      markTwoFactorDisabled();
      cancelDisable2FA();
      setTwoFaMsg({ ok: true, text: "Two-factor authentication is off." });
    } catch (err) {
      setDisableMsg(apiError(err, "Couldn't turn off 2FA."));
    } finally {
      setDisableSaving(false);
    }
  }

  return (
    <div className="app-shell">
      <AppSidebar />
      <div className="app-content">
        <AppTopbar title="Profile" />
        <main className={styles.content}>
          <section className={styles.card}>
            <div className={styles.identity}>
              <div className={styles.avatar}>{initials}</div>
              <div className={styles.identityText}>
                <h2>{displayName || "No name set"}</h2>
                <div className={styles.muted}>{email}</div>
              </div>
            </div>

            <dl className={styles.rows}>
              <dt>Role</dt>
              <dd>
                <span className={`${styles.pill} ${isSuperAdmin ? styles.admin : (role && styles[role]) || ""}`}>
                  {isSuperAdmin ? "super admin" : role ?? "—"}
                </span>
              </dd>

              <dt>Member since</dt>
              <dd>{memberSince}</dd>
            </dl>
          </section>

          <section className={styles.section}>
            <h3>Display name</h3>
            <p className={styles.hint}>Shown to admins in the user list.</p>
            <form onSubmit={saveName}>
              <label className={styles.field}>
                <span>Name</span>
                <input
                  type="text"
                  maxLength={80}
                  placeholder="Jane Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              {nameMsg && (
                <p className={nameMsg.ok ? styles.ok : styles.error}>{nameMsg.text}</p>
              )}
              <button
                type="submit"
                className={styles.saveBtn}
                disabled={nameSaving || name.trim() === (displayName ?? "")}
              >
                {nameSaving ? "Saving…" : "Save name"}
              </button>
            </form>
          </section>

          {hasPasswordLogin && (
          <section className={styles.section}>
            <h3>Change password</h3>
            <p className={styles.hint}>You'll need your current password to confirm.</p>
            <form onSubmit={savePassword}>
              <label className={styles.field}>
                <span>Current password</span>
                <PasswordField
                  autoComplete="current-password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  required
                />
              </label>
              <div className={styles.row2}>
                <label className={styles.field}>
                  <span>New password</span>
                  <PasswordField
                    autoComplete="new-password"
                    value={next}
                    onChange={(e) => setNext(e.target.value)}
                    required
                  />
                  <span className={styles.fieldHint}>{PASSWORD_RULE_TEXT}</span>
                </label>
                <label className={styles.field}>
                  <span>Confirm new password</span>
                  <PasswordField
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                  />
                </label>
              </div>
              {pwMsg && <p className={pwMsg.ok ? styles.ok : styles.error}>{pwMsg.text}</p>}
              <button type="submit" className={styles.saveBtn} disabled={pwSaving}>
                {pwSaving ? "Updating…" : "Update password"}
              </button>
            </form>
          </section>
          )}

          <section className={styles.section}>
            <h3>Two-factor authentication</h3>
            <p className={styles.hint}>
              Require a 6-digit code from an authenticator app when signing in.
            </p>

            <div className={styles.twoFaStatus}>
              <span className={`${styles.pill} ${twoFactorEnabled ? styles.active : ""}`}>
                {twoFactorEnabled === null ? "Checking…" : twoFactorEnabled ? "On" : "Off"}
              </span>
              {twoFactorEnabled === false && !showEnable2FA && (
                <button type="button" className={styles.saveBtn} onClick={startEnable2FA}>
                  Turn on 2FA
                </button>
              )}
              {twoFactorEnabled === true && !showDisable2FA && (
                <button type="button" className={styles.dangerBtn} onClick={() => setShowDisable2FA(true)}>
                  Turn off 2FA
                </button>
              )}
            </div>

            {twoFaMsg && <p className={twoFaMsg.ok ? styles.ok : styles.error}>{twoFaMsg.text}</p>}

            {showEnable2FA && (
              <div className={styles.twoFaPanel}>
                <p className={styles.hint}>
                  Scan this QR code with your authenticator app, then enter the 6-digit code it shows.
                </p>
                {setupData?.qrCode && (
                  <img src={setupData.qrCode} alt="2FA setup QR code" className={styles.qrImage} />
                )}
                {setupData?.secret && (
                  <p className={styles.secretText}>
                    Or enter manually: <code>{setupData.secret}</code>
                  </p>
                )}
                <form onSubmit={handleVerifyEnable}>
                  <label className={styles.field}>
                    <span>6-digit code</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={setupCode}
                      onChange={(e) => setSetupCode(e.target.value)}
                    />
                  </label>
                  {setupMsg && <p className={styles.error}>{setupMsg}</p>}
                  <div className={styles.btnRow}>
                    <button type="submit" className={styles.saveBtn} disabled={setupSaving}>
                      {setupSaving ? "Verifying…" : "Verify & turn on"}
                    </button>
                    <button type="button" className={styles.cancelBtn} onClick={cancelEnable2FA}>
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {showDisable2FA && (
              <div className={styles.twoFaPanel}>
                <p className={styles.hint}>Enter your current 6-digit code to confirm turning 2FA off.</p>
                <form onSubmit={handleDisable}>
                  <label className={styles.field}>
                    <span>6-digit code</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={disableCode}
                      onChange={(e) => setDisableCode(e.target.value)}
                    />
                  </label>
                  {disableMsg && <p className={styles.error}>{disableMsg}</p>}
                  <div className={styles.btnRow}>
                    <button type="submit" className={styles.dangerBtn} disabled={disableSaving}>
                      {disableSaving ? "Turning off…" : "Turn off 2FA"}
                    </button>
                    <button type="button" className={styles.cancelBtn} onClick={cancelDisable2FA}>
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
