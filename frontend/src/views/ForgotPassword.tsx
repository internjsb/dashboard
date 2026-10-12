import { useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { sendPasswordResetEmail } from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { auth } from "../firebase";
import styles from "./Login.module.css";

// "Forgot password?" — Firebase emails a reset link; the link opens Firebase's
// own reset page, then the user signs in again with the new password.
export default function ForgotPassword() {
  // Pre-fill with whatever was typed on the sign-in form.
  const initialEmail = (useLocation().state as { email?: string } | null)?.email ?? "";
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSentTo(email.trim());
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : undefined;
      // Don't reveal whether an account exists for this email.
      if (code === "auth/user-not-found") setSentTo(email.trim());
      else setError(mapError(code));
    } finally {
      setLoading(false);
    }
  }

  function mapError(code?: string): string {
    switch (code) {
      case "auth/invalid-email":
        return "Enter a valid email address.";
      case "auth/too-many-requests":
        return "Too many attempts. Try again in a moment.";
      default:
        return "Couldn't send the reset email. Please try again.";
    }
  }

  return (
    <div className={styles.loginScreen}>
      <div className={styles.loginCard}>
        <div className={styles.brand}>
          <div className={styles.brandMark}>Jsb</div>
          <span>Amazon Dashboard</span>
        </div>

        <h1>Reset password</h1>
        <p className={styles.subtitle}>Enter your email and we'll send you a link to set a new password.</p>

        {sentTo ? (
          <>
            <p className={styles.success}>
              If an account exists for <strong>{sentTo}</strong>, a reset link is on its way. Check your inbox (and
              spam folder).
            </p>
            <button type="button" className={styles.linkBtn} onClick={() => setSentTo("")}>
              Use a different email
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <label className={styles.field}>
              <span>Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="example@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            {error && <p className={styles.error}>{error}</p>}

            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? "Sending..." : "Send reset link"}
            </button>
          </form>
        )}

        <p className={styles.alt}>
          Remembered it? <Link to="/login">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
