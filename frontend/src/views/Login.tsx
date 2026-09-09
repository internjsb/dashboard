import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { auth } from "../firebase";
import GoogleButton from "../components/GoogleButton";
import styles from "./Login.module.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate(searchParams.get("redirect") || "/dashboard");
    } catch (err) {
      setError(mapError(err instanceof FirebaseError ? err.code : undefined));
    } finally {
      setLoading(false);
    }
  }

  function mapError(code?: string): string {
    switch (code) {
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return "Incorrect email or password.";
      case "auth/user-disabled":
        return "This account has been disabled. Contact an administrator.";
      case "auth/too-many-requests":
        return "Too many attempts. Try again in a moment.";
      default:
        return "Couldn't sign in. Please try again.";
    }
  }

  return (
    <div className={styles.loginScreen}>
      <div className={styles.loginCard}>
        <div className={styles.brand}>
          <div className={styles.brandMark}>A</div>
          <span>Amazon Dashboard</span>
        </div>

        <h1>Sign in</h1>
        <p className={styles.subtitle}>Use your assigned email and password to continue.</p>

        <form onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span>Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label className={styles.field}>
            <span>Password</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <GoogleButton redirectTo={searchParams.get("redirect") || undefined} />

        <p className={styles.alt}>
          Don't have an account? <Link to="/register">Create one</Link>
        </p>
      </div>
    </div>
  );
}
