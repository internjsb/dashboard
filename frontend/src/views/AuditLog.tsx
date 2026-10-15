import { useEffect, useState } from "react";
import AppSidebar from "../components/AppSidebar";
import AppTopbar from "../components/AppTopbar";
import DataTable, { type DataTableColumn } from "../components/DataTable";
import api from "../api/client";
import type { AuditEvent } from "../types";
import styles from "./AuditLog.module.css";
import { describe, deviceFromUA, changesOf, pageOf, subjectOf, placeOf, when } from "../lib/auditFormat";

export default function AuditLog() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [scope, setScope] = useState<"all" | "own">("own");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get<{ events: AuditEvent[]; scope: "all" | "own" }>("/audit");
      setScope(data.scope);
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
      // Full email; search also matches their display name.
      accessor: (e) => `${e.actorEmail || e.actorUid || ""} ${e.actorName || ""}`.trim(),
      className: styles.who,
      render: (e) =>
        e.aboutYou ? (
          <span className={styles.hidden} title="Who made this change isn't shown">
            —
          </span>
        ) : (
          <span title={e.actorName || undefined}>{e.actorEmail || e.actorUid || "—"}</span>
        ),
    },
    {
      key: "action",
      header: "Action",
      accessor: (e) => describe(e),
      render: (e) => <span className={styles.action}>{describe(e)}</span>,
    },
    {
      key: "details",
      header: "Details",
      accessor: (e) => `${pageOf(e.action)} ${subjectOf(e) ?? ""} ${changesOf(e).join(" ")}`,
      render: (e) => {
        const subject = subjectOf(e);
        const changes = changesOf(e);
        return (
          <span className={styles.details}>
            <span className={styles.pageTag}>{pageOf(e.action)}</span>
            {subject && <span className={styles.subject}>{subject}</span>}
            {changes.length > 0 && (
              <ul className={styles.changes}>
                {changes.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
          </span>
        );
      },
    },
    {
      key: "location",
      header: "Location",
      accessor: (e) => placeOf(e),
      className: styles.device,
      render: (e) => (
        <span className={styles.location} title={e.ip ? `IP ${e.ip}` : undefined}>
          <span>{placeOf(e)}</span>
          {e.ip && <span className={styles.ip}>{e.ip}</span>}
        </span>
      ),
    },
    {
      key: "device",
      header: "Device",
      accessor: (e) => deviceFromUA(e.userAgent),
      className: styles.device,
      render: (e) => (e.aboutYou ? "—" : <span title={e.userAgent}>{deviceFromUA(e.userAgent)}</span>),
    },
  ];

  return (
    <div className="app-shell">
      <AppSidebar />
      <div className="app-content">
        <AppTopbar title="Audit log" />
        <main className={styles.content}>
          <div className={styles.head}>
            <p className={styles.intro}>
              {scope === "all"
                ? "Every user's sign-ins and actions. Most recent first (last 300)."
                : "Your own sign-ins and actions, plus changes made to your admin access. Most recent first (last 300)."}
            </p>
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
              rowClassName={(e) => (e.aboutYou ? styles.aboutYouRow : "")}
              emptyMessage="No events recorded yet."
            />
          )}
        </main>
      </div>
    </div>
  );
}
