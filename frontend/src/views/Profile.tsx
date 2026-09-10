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
import styles from "./Profile.module.css";

function apiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string } | undefined;
    return data?.error || fallback;
  }
  return fallback;
}

export default function Profile() {
  const { user, displayName, role, isSuperAdmin, refreshProfile } = useAuth();

  const email = user?.email ?? "";
  const initials = (displayName || email || "?").slice(0, 2).toUpperCase();
  // Only email/password accounts can change a password here — Google accounts
  // manage their credentials with Google.
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

    if (next.length < 6) {
      setPwMsg({ ok: false, text: "New password must be at least 6 characters." });
      return;
    }
    if (next !== confirm) {
      setPwMsg({ ok: false, text: "New passwords don't match." });
      return;
    }
    if (!auth.currentUser || !email) return;

    setPwSaving(true);
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
        return "New password is too weak — use at least 6 characters.";
      case "auth/too-many-requests":
        return "Too many attempts. Try again in a moment.";
      case "auth/requires-recent-login":
        return "Please sign out and back in, then try again.";
      default:
        return "Couldn't change your password.";
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
        </main>
      </div>
    </div>
  );
}
