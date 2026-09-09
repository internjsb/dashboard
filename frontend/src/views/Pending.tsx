import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import styles from "./Pending.module.css";

export default function Pending() {
  const { user, status, signOut, refreshRole } = useAuth();
  const navigate = useNavigate();

  const [checking, setChecking] = useState(false);
  const [stillPending, setStillPending] = useState(false);

  // Context state updates asynchronously (unlike a Vue ref, a plain closure
  // variable here would be stale after `await`), so track the latest value
  // in a ref to read it right after refreshRole() resolves.
  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  async function recheck() {
    setChecking(true);
    setStillPending(false);
    try {
      await refreshRole();
      if (statusRef.current === "active") navigate("/dashboard");
      else setStillPending(true);
    } finally {
      setChecking(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    navigate("/login");
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.brandMark}>A</div>
        <h1>Awaiting approval</h1>
        <p>
          Your account for <strong>{user?.email}</strong> was created and is waiting for an administrator to
          approve it. You'll be able to open the dashboard once it's approved.
        </p>
        <div className={styles.actions}>
          <button className={styles.ghost} disabled={checking} onClick={recheck}>
            {checking ? "Checking…" : "Check again"}
          </button>
          <button className={styles.ghost} onClick={handleSignOut}>
            Sign out
          </button>
        </div>
        {stillPending && <p className={styles.note}>Still pending — try again later.</p>}
      </div>
    </div>
  );
}
