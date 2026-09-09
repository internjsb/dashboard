import { useEffect, useState } from "react";
import AppSidebar from "../components/AppSidebar";
import AppTopbar from "../components/AppTopbar";
import api from "../api/client";
import type { AuditEvent } from "../types";
import styles from "./AuditLog.module.css";

const ACTION_LABEL: Record<string, string> = {
  "auth.login": "Signed in",
  "auth.signup": "Registered",
  "profile.update": "Updated profile",
  "user.approve": "Approved user",
  "user.deny": "Denied user",
  "user.role_change": "Changed role",
  "user.remove_orphan": "Removed orphaned request",
};

function label(action: string): string {
  return ACTION_LABEL[action] ?? action;
}

function deviceFromUA(ua: string): string {
  if (!ua || ua === "unknown") return "Unknown";

  // Check mobile FIRST — an iPhone's UA also contains "like Mac OS X".
  let device: string;
  if (/iPhone/.test(ua)) device = "iPhone";
  else if (/iPad/.test(ua)) device = "iPad";
  else if (/Android/.test(ua)) device = /Mobile/.test(ua) ? "Android phone" : "Android tablet";
  else if (/CrOS/.test(ua)) device = "Chromebook";
  else if (/Macintosh|Mac OS X/.test(ua)) device = "MacBook";
  else if (/Windows NT/.test(ua)) device = "Windows PC";
  else if (/Linux/.test(ua)) device = "Linux PC";
  else device = "Unknown device";

  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /Firefox\/|FxiOS/.test(ua)
        ? "Firefox"
        : /CriOS/.test(ua) || (/Chrome\//.test(ua) && !/Chromium/.test(ua))
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "browser";

  return `${browser} · ${device}`;
}

function when(ts: number): { date: string; time: string; rel: string } {
  const d = new Date(ts);
  const date = d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const m = Math.round((Date.now() - ts) / 60000);
  let rel: string;
  if (m < 1) rel = "just now";
  else if (m < 60) rel = `${m}m ago`;
  else if (m < 1440) rel = `${Math.round(m / 60)}h ago`;
  else rel = `${Math.round(m / 1440)}d ago`;
  return { date, time, rel };
}

export default function AuditLog() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get<{ events: AuditEvent[] }>("/audit");
      setEvents(data.events);
    } catch (err) {
      setError("Couldn't load the audit log. Is the backend running?");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="app-shell">
      <AppSidebar />
      <div className="app-content">
        <AppTopbar title="Audit log" />
        <main className={styles.content}>
          <div className={styles.head}>
            <p className={styles.intro}>Every sign-in and admin action. Most recent first (last 300).</p>
            <button className={styles.refresh} onClick={load} disabled={loading}>
              Refresh
            </button>
          </div>

          {loading ? (
            <p className={styles.state}>Loading…</p>
          ) : error ? (
            <p className={`${styles.state} ${styles.error}`}>{error}</p>
          ) : events.length === 0 ? (
            <p className={styles.state}>No activity recorded yet.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Who</th>
                    <th>Action</th>
                    <th>Device</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => {
                    const t = when(e.at);
                    return (
                      <tr key={e.id}>
                        <td className={styles.when} title={t.rel}>
                          <span className={styles.date}>{t.date}</span>
                          <span className={styles.time}>{t.time}</span>
                        </td>
                        <td className={styles.who}>{e.actorEmail || e.actorUid || "—"}</td>
                        <td>
                          <span className={styles.action}>{label(e.action)}</span>
                        </td>
                        <td className={styles.device} title={e.userAgent}>{deviceFromUA(e.userAgent)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
