import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { auth } from "../firebase";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import GoogleButton from "../components/GoogleButton";
import PasswordField from "../components/PasswordField";
import type { UserStatus } from "../types";
import styles from "./Register.module.css";

export default function Register() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { refreshRole } = useAuth();

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);

    // Step 1 — create the Firebase Auth account.
    let name = displayName.trim();
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      if (name) await updateProfile(user, { displayName: name });
    } catch (err) {
      console.error("Firebase createUser failed:", err);
      setError(mapError(err instanceof FirebaseError ? err.code : undefined));
      setLoading(false);
      return;
    }

    // Step 2 — provision the account record on our backend.
    try {
      const { data } = await api.post<{ status: UserStatus }>("/register", { displayName: name });
      await refreshRole();
      navigate(data.status === "active" ? "/dashboard" : "/pending");
    } catch (err) {
      console.error("Backend /register failed:", err);
      let detail = "";
      if (axios.isAxiosError(err)) {
        detail = err.response
          ? ` (server ${err.response.status}${
              (err.response.data as { error?: string })?.error
                ? `: ${(err.response.data as { error?: string }).error}`
                : ""
            })`
          : " (no response from the API)";
      }
      setError(
        `Your login was created, but finishing setup failed${detail}. An admin can still approve you, or try signing in.`
      );
    } finally {
      setLoading(false);
    }
  }

  function mapError(code?: string): string {
    switch (code) {
      case "auth/email-already-in-use":
        return "An account with that email already exists.";
      case "auth/invalid-email":
        return "That doesn't look like a valid email.";
      case "auth/weak-password":
        return "Password is too weak — use at least 6 characters.";
      case "auth/operation-not-allowed":
        return "Email/password sign-up is disabled for this project.";
      default:
        return "Couldn't create the account. Please try again.";
    }
  }

  return (
    <div className={styles.loginScreen}>
      <div className={styles.loginCard}>
        <div className={styles.brand}>
          <div className={styles.brandMark}>A</div>
          <span>Amazon Dashboard</span>
        </div>

        <h1>Create account</h1>
        <p className={styles.subtitle}>Admin will approve after the account has created. </p>

        <form onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span>Name</span>
            <input
              type="text"
              autoComplete="name"
              placeholder="Jane Doe"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </label>

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
            <PasswordField
              required
              autoComplete="new-password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          <label className={styles.field}>
            <span>Confirm password</span>
            <PasswordField
              required
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>

          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? "Creating…" : "Create account"}
          </button>
        </form>

        <GoogleButton />

        <p className={styles.alt}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
