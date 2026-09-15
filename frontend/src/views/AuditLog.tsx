import { useEffect, useState } from "react";
import AppSidebar from "../components/AppSidebar";
import AppTopbar from "../components/AppTopbar";
import DataTable, { type DataTableColumn } from "../components/DataTable";
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
  "user.disable": "Disabled account",
  "user.enable": "Enabled account",
  "user.remove": "Removed user",
  "user.remove_orphan": "Removed orphaned request",
  "user.department_change": "Changed department",
};

function label(action: string): string {
  return ACTION_LABEL[action] ?? action;
}

type Detail = Record<string, unknown> | null | undefined;

function str(d: Detail, key: string): string | null {
  const v = d?.[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

// "alice@example.com" -> "alice". Leaves anything without an "@" untouched.
function username(value: string | null | undefined): string | null {
  if (!value) return null;
  const at = value.indexOf("@");
  return at > 0 ? value.slice(0, at) : value;
}

const ROLE_NAME: Record<string, string> = {
  admin: "an admin",
  user: "a standard user",
};

const DEPARTMENT_NAME: Record<string, string> = {
  super_user: "Super user",
  sales: "Sales",
  supplychain: "Supply chain",
  finance: "Finance",
};

// A plain-English sentence describing exactly what happened, using the event's
// stored detail. Falls back to the short action label when detail is missing.
function describe(e: AuditEvent): string {
  const d = e.detail;
  const who = username(str(d, "email")) || str(d, "targetUid") || "this person";

  switch (e.action) {
    case "auth.login": {
      const method = str(d, "method");
      return method === "google" ? "Signed in with Google" : "Signed in";
    }
    case "auth.signup": {
      const name = username(str(d, "email")) || "a new account";
      const status = str(d, "status");
      return status === "active"
        ? `Registered ${name} (auto-approved)`
        : `Registered ${name} (awaiting approval)`;
    }
    case "user.approve": {
      const dept = str(d, "department");
      return dept
        ? `Approved ${who} for access (${DEPARTMENT_NAME[dept] || dept})`
        : `Approved ${who} for access`;
    }
    case "user.deny":
      return `Denied ${who} access`;
    case "user.disable":
      return `Disabled ${who}'s account`;
    case "user.enable":
      return `Re-enabled ${who}'s account`;
    case "user.remove":
      return `Removed ${who}'s account`;
    case "user.remove_orphan":
      return `Removed ${who}'s orphaned request`;
    case "user.role_change": {
      const role = str(d, "role") || "";
      return `Changed ${who} to ${ROLE_NAME[role] || `"${role}"`}`;
    }
    case "user.department_change": {
      const dept = str(d, "department");
      return dept ? `Set ${who}'s department to ${DEPARTMENT_NAME[dept] || dept}` : `Cleared ${who}'s department`;
    }
    default:
      return label(e.action);
  }
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
      // Orphan-cleanup events are internal housekeeping — not worth showing.
      setEvents(data.events.filter((e) => e.action !== "user.remove_orphan"));
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

  const columns: DataTableColumn<AuditEvent>[] = [
    {
      key: "when",
      header: "When",
      accessor: (e) => e.at,
      searchable: false,
      render: (e) => {
        const t = when(e.at);
        return (
          <span className={styles.when} title={t.rel}>
            <span className={styles.date}>{t.date}</span>
            <span className={styles.time}>{t.time}</span>
          </span>
        );
      },
    },
    {
      key: "who",
      header: "Who",
      accessor: (e) => username(e.actorEmail) || e.actorUid || "",
      className: styles.who,
      render: (e) => <span title={e.actorEmail || undefined}>{username(e.actorEmail) || e.actorUid || "—"}</span>,
    },
    {
      key: "action",
      header: "Action",
      accessor: (e) => describe(e),
      render: (e) => <span className={styles.action}>{describe(e)}</span>,
    },
    {
      key: "device",
      header: "Device",
      accessor: (e) => deviceFromUA(e.userAgent),
      className: styles.device,
      render: (e) => <span title={e.userAgent}>{deviceFromUA(e.userAgent)}</span>,
    },
  ];

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
            <DataTable
              columns={columns}
              rows={events}
              rowKey={(e) => e.id}
              showSearch={false}
              emptyMessage="No events recorded yet."
            />
          )}
        </main>
      </div>
    </div>
  );
}
