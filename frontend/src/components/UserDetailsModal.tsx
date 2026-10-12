import { useEffect, useState } from "react";
import axios from "axios";
import api from "../api/client";
import { changesOf, describe, deviceFromUA, pageOf, placeOf, subjectOf, when } from "../lib/auditFormat";
import type { AuditEvent, Department, Role, UserStatus } from "../types";
import styles from "./UserDetailsModal.module.css";

// GET /api/users/:uid/details (super admin only).
interface UserDetails {
  user: {
    uid: string;
    email: string | null;
    displayName: string | null;
    role: Role;
    status: UserStatus;
    department: Department | null;
    isSuperAdmin: boolean;
    disabled: boolean;
    createdAt: string | null;
    lastSignInTime: string | null;
  };
  lastLogin: { at: number; ip: string | null; location: AuditEvent["location"]; userAgent: string } | null;
  lastChange: AuditEvent | null;
  recentChanges: AuditEvent[];
  nameChanges: { at: number; displayName: string | null }[];
}

const DEPARTMENT_LABEL: Record<Department, string> = {
  super_user: "Super user",
  sales: "Sales",
  supplychain: "Supply chain",
  finance: "Finance",
};

function stamp(ts: number): string {
  const w = when(ts);
  return `${w.date}, ${w.time} · ${w.rel}`;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.row}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function ChangeLine({ e }: { e: AuditEvent }) {
  const subject = subjectOf(e);
  const lines = changesOf(e);
  return (
    <div className={styles.change}>
      <div className={styles.changeHead}>
        <strong>{describe(e)}</strong>
        <span className={styles.page}>{pageOf(e.action)}</span>
      </div>
      {subject && <div className={styles.subject}>{subject}</div>}
      {lines.length > 0 && (
        <ul className={styles.diff}>
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      )}
      <div className={styles.when}>{stamp(e.at)}</div>
    </div>
  );
}

// "User details" pop-up on Manage users — account info plus what the audit
// log knows about this person (last sign-in, latest change, name changes).
export default function UserDetailsModal({ uid, onClose }: { uid: string; onClose: () => void }) {
  const [data, setData] = useState<UserDetails | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api
      .get<UserDetails>(`/users/${uid}/details`)
      .then(({ data }) => !cancelled && setData(data))
      .catch((err) => {
        if (cancelled) return;
        const msg = axios.isAxiosError(err) ? (err.response?.data as { error?: string } | undefined)?.error : null;
        setError(msg || "Couldn't load this user's details.");
      });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const u = data?.user;
  const login = data?.lastLogin;
  const earlierChanges = data?.recentChanges.slice(1) ?? [];

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="user-details-title" onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.head}>
          <div className={styles.avatar}>{(u?.email || "?").slice(0, 2).toUpperCase()}</div>
          <div className={styles.headText}>
            <h3 id="user-details-title">{u ? u.displayName || u.email : "User details"}</h3>
            {u?.displayName && <span className={styles.sub}>{u.email}</span>}
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {error ? (
          <p className={styles.error}>{error}</p>
        ) : !data || !u ? (
          <p className={styles.muted}>Loading…</p>
        ) : (
          <div className={styles.body}>
            <section>
              <h4>Account</h4>
              <dl className={styles.grid}>
                <Row label="Email">{u.email || "—"}</Row>
                <Row label="Display name">{u.displayName || <span className={styles.muted}>Not set</span>}</Row>
                <Row label="Role">
                  <span className={styles.pill}>{u.isSuperAdmin ? "super admin" : u.role}</span>
                </Row>
                <Row label="Department">
                  {u.isSuperAdmin ? "—" : u.department ? DEPARTMENT_LABEL[u.department] : "Unassigned"}
                </Row>
                <Row label="Status">
                  <span className={styles.pill}>{u.status}</span>
                </Row>
                <Row label="Joined">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}</Row>
              </dl>
            </section>

            <section>
              <h4>Last sign-in</h4>
              {login ? (
                <dl className={styles.grid}>
                  <Row label="When">{stamp(login.at)}</Row>
                  <Row label="From">{placeOf(login)}</Row>
                  <Row label="IP address">{login.ip || "—"}</Row>
                  <Row label="Device">{deviceFromUA(login.userAgent)}</Row>
                </dl>
              ) : u.lastSignInTime ? (
                <p className={styles.muted}>
                  {stamp(new Date(u.lastSignInTime).getTime())} — signed in before location tracking, so no place or
                  device is recorded.
                </p>
              ) : (
                <p className={styles.muted}>Has never signed in.</p>
              )}
            </section>

            <section>
              <h4>Latest change</h4>
              {data.lastChange ? (
                <ChangeLine e={data.lastChange} />
              ) : (
                <p className={styles.muted}>No changes recorded.</p>
              )}
              {earlierChanges.length > 0 && (
                <details className={styles.more}>
                  <summary>Earlier changes ({earlierChanges.length})</summary>
                  {earlierChanges.map((e) => (
                    <ChangeLine key={e.id} e={e} />
                  ))}
                </details>
              )}
            </section>

            {data.nameChanges.length > 0 && (
              <section>
                <h4>Display name changes</h4>
                <ul className={styles.names}>
                  {data.nameChanges.map((n) => (
                    <li key={n.at}>
                      <span>{n.displayName || <em className={styles.muted}>cleared</em>}</span>
                      <span className={styles.when}>{stamp(n.at)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
