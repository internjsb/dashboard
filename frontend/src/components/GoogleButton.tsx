import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
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

    // Step 1 — Google popup.
    let displayName = "";
    try {
      const cred = await signInWithPopup(auth, provider);
      displayName = cred.user.displayName ?? "";
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : undefined;
      console.error("Google popup failed:", code, err);
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        // dismissed — no message
      } else if (code === "auth/popup-blocked") {
        setError("Your browser blocked the popup. Allow popups for this site and try again.");
      } else if (code === "auth/unauthorized-domain") {
        setError("This domain isn't in Firebase → Authentication → Settings → Authorized domains.");
      } else if (code === "auth/account-exists-with-different-credential") {
        setError("An account with this email already exists — sign in with your password.");
      } else if (code === "auth/operation-not-allowed") {
        setError("Google sign-in isn't enabled (Firebase → Authentication → Sign-in method).");
      } else {
        setError(`Google sign-in failed${code ? ` (${code})` : ""}.`);
      }
      setLoading(false);
      return;
    }

    // Step 2 — provision / look up the account on our backend.
    try {
      const { data } = await api.post<{ status: UserStatus }>("/register", { displayName });
      await refreshRole();
      navigate(data.status === "active" ? redirectTo || "/dashboard" : "/pending");
    } catch (err) {
      console.error("Provisioning after Google sign-in failed:", err);
      let detail = "";
      if (axios.isAxiosError(err)) {
        detail = err.response
          ? ` (server ${err.response.status}${
              (err.response.data as { error?: string })?.error
                ? `: ${(err.response.data as { error?: string }).error}`
                : ""
            })`
          : " (no response — is the API reachable?)";
      }
      setError(`Signed in with Google, but setting up your account failed${detail}.`);
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
