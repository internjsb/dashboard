import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { auth } from "../firebase";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { UserStatus } from "../types";
import styles from "./GoogleButton.module.css";

const provider = new GoogleAuthProvider();

interface Props {
  /** where to send an already-approved user (defaults to /dashboard) */
  redirectTo?: string;
}

export default function GoogleButton({ redirectTo }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { refreshRole } = useAuth();

  async function handleGoogle() {
    setError("");
    setLoading(true);
    try {
      const cred = await signInWithPopup(auth, provider);

      // Idempotent: creates a "pending" mirror record for a first-time user,
      // and just returns the current status/role for a returning one. Same
      // call works from both the Login and Register pages.
      const { data } = await api.post<{ status: UserStatus }>("/register", {
        displayName: cred.user.displayName ?? "",
      });

      await refreshRole();
      navigate(data.status === "active" ? redirectTo || "/dashboard" : "/pending");
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : undefined;
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        // user dismissed the popup — no message needed
      } else if (code === "auth/popup-blocked") {
        setError("Your browser blocked the popup. Allow popups for this site and try again.");
      } else if (code === "auth/account-exists-with-different-credential") {
        setError("An account with this email already exists — sign in with your password.");
      } else if (code === "auth/operation-not-allowed") {
        setError("Google sign-in isn't enabled for this project yet.");
      } else {
        setError("Couldn't sign in with Google. Please try again.");
        console.error(err);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className={styles.divider}>
        <span>or</span>
      </div>

      <button type="button" className={styles.googleBtn} onClick={handleGoogle} disabled={loading}>
        <svg className={styles.icon} viewBox="0 0 18 18" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
          />
          <path
            fill="#34A853"
            d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
          />
          <path
            fill="#FBBC05"
            d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33Z"
          />
          <path
            fill="#EA4335"
            d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
          />
        </svg>
        {loading ? "Signing in…" : "Continue with Google"}
      </button>

      {error && <p className={styles.error}>{error}</p>}
    </>
  );
}
