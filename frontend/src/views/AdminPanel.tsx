import { useEffect, useState } from "react";
import axios from "axios";
import AppSidebar from "../components/AppSidebar";
import AppTopbar from "../components/AppTopbar";
import DataTable, { type DataTableColumn } from "../components/DataTable";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { UserRecord, PendingRequest, Role, UserStatus, Department } from "../types";
import styles from "./AdminPanel.module.css";

const DEPARTMENT_LABEL: Record<Department, string> = {
  super_user: "Super user",
  sales: "Sales",
  supplychain: "Supply chain",
  finance: "Finance",
};

const DEPARTMENT_OPTIONS = Object.entries(DEPARTMENT_LABEL).map(([value, label]) => ({ value, label }));

function errorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string } | undefined;
    return data?.error || fallback;
  }
  return fallback;
}

export default function AdminPanel() {
  const { user, isSuperAdmin } = useAuth();
  const currentUid = user?.uid;

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<UserRecord | null>(null);
  const [requestDept, setRequestDept] = useState<Record<string, Department | "">>({});

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [u, r] = await Promise.all([
        api.get<{ users: UserRecord[] }>("/users"),
        api.get<{ requests: PendingRequest[] }>("/requests"),
      ]);
      setUsers(u.data.users);
      setRequests(r.data.requests);
    } catch (err) {
      setError("Couldn't load users. Is the backend running?");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function approve(r: PendingRequest) {
    const department = requestDept[r.uid];
    if (!department) return; // Approve button is disabled until one's chosen, but don't trust that alone.

    setBusyUid(r.uid);
    try {
      await api.post(`/requests/${r.uid}/approve`, { department });
    } catch (err) {
      window.alert(errorMessage(err, "Failed to approve"));
    } finally {
      await load(); // server state may have changed even on error (orphan cleanup)
      setBusyUid(null);
    }
  }

  async function deny(r: PendingRequest) {
    if (!window.confirm(`Deny ${r.email}? Their login will be disabled.`)) return;
    setBusyUid(r.uid);
    try {
      await api.post(`/requests/${r.uid}/deny`);
    } catch (err) {
      window.alert(errorMessage(err, "Failed to deny"));
    } finally {
      await load();
      setBusyUid(null);
    }
  }

  async function changeRole(target: UserRecord, role: Role) {
    setBusyUid(target.uid);
    try {
      await api.patch(`/users/${target.uid}/role`, { role });
      setUsers((prev) => prev.map((u) => (u.uid === target.uid ? { ...u, role } : u)));
    } catch (err) {
      window.alert(errorMessage(err, "Failed to update role"));
    } finally {
      setBusyUid(null);
    }
  }

  async function setDisabled(target: UserRecord, disabled: boolean) {
    setBusyUid(target.uid);
    try {
      const { data } = await api.patch<{ status: UserStatus }>(
        `/users/${target.uid}/disabled`,
        { disabled },
      );
      setUsers((prev) =>
        prev.map((u) => (u.uid === target.uid ? { ...u, disabled, status: data.status } : u)),
      );
    } catch (err) {
      window.alert(errorMessage(err, "Failed to update account"));
    } finally {
      setBusyUid(null);
    }
  }

  async function setDepartment(target: UserRecord, department: Department | "") {
    setBusyUid(target.uid);
    try {
      await api.patch(`/users/${target.uid}/department`, { department: department || null });
      setUsers((prev) =>
        prev.map((u) => (u.uid === target.uid ? { ...u, department: department || null } : u)),
      );
    } catch (err) {
      window.alert(errorMessage(err, "Failed to update department"));
    } finally {
      setBusyUid(null);
    }
  }

  async function removeUser(target: UserRecord) {
    setConfirmRemove(null);
    setBusyUid(target.uid);
    try {
      await api.delete(`/users/${target.uid}`);
      setUsers((prev) => prev.filter((u) => u.uid !== target.uid));
    } catch (err) {
      window.alert(errorMessage(err, "Failed to remove user"));
    } finally {
      setBusyUid(null);
    }
  }

  function formatDate(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString();
  }

  const columns: DataTableColumn<UserRecord>[] = [
    {
      key: "user",
      header: "User",
      accessor: (u) => u.email,
      render: (u) => (
        <div className={styles.who}>
          <div className={styles.avatar}>{(u.email || "?").slice(0, 2).toUpperCase()}</div>
          <div>
            <div className={styles.email}>{u.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      accessor: (u) => (u.isSuperAdmin ? "super admin" : u.role),
      render: (u) => (
        <span className={`${styles.pill} ${(u.isSuperAdmin ? styles.admin : styles[u.role]) || ""}`}>
          {u.isSuperAdmin ? "super admin" : u.role}
        </span>
      ),
    },
    {
      key: "department",
      header: "Department",
      accessor: (u) => (u.isSuperAdmin ? "" : u.department ? DEPARTMENT_LABEL[u.department] : ""),
      render: (u) =>
        u.isSuperAdmin ? (
          <span className={styles.locked}>—</span>
        ) : u.uid === currentUid ? (
          <span className={styles.locked}>{u.department ? DEPARTMENT_LABEL[u.department] : "Unassigned"}</span>
        ) : (
          <select
            className={styles.deptSelect}
            value={u.department ?? ""}
            disabled={busyUid === u.uid}
            onChange={(e) => setDepartment(u, e.target.value as Department | "")}
          >
            {DEPARTMENT_OPTIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        ),
    },
    {
      key: "status",
      header: "Status",
      accessor: (u) => u.status,
      render: (u) => <span className={`${styles.pill} ${styles[u.status] || ""}`}>{u.status}</span>,
    },
    {
      key: "joined",
      header: "Joined",
      accessor: (u) => (u.createdAt ? new Date(u.createdAt).getTime() : 0),
      className: styles.joined,
      render: (u) => formatDate(u.createdAt),
    },
    {
      key: "actions",
      header: "",
      sortable: false,
      searchable: false,
      className: styles.actions,
      render: (u) =>
        u.isSuperAdmin ? (
          <span className={styles.locked}>locked</span>
        ) : u.uid === currentUid ? (
          <span className={styles.locked}>you</span>
        ) : (
          <>
            {isSuperAdmin &&
              (u.role !== "admin" ? (
                <button
                  className={styles.promote}
                  disabled={busyUid === u.uid || u.status !== "active"}
                  onClick={() => changeRole(u, "admin")}
                >
                  Make admin
                </button>
              ) : (
                <button
                  className={styles.demote}
                  disabled={busyUid === u.uid}
                  onClick={() => changeRole(u, "user")}
                >
                  Revoke admin
                </button>
              ))}
            {u.status === "disabled" || u.status === "denied" ? (
              <button
                className={styles.enable}
                disabled={busyUid === u.uid}
                onClick={() => setDisabled(u, false)}
              >
                Enable
              </button>
            ) : (
              <button
                className={styles.disable}
                disabled={busyUid === u.uid}
                onClick={() => setDisabled(u, true)}
              >
                Disable
              </button>
            )}
            <button
              className={styles.remove}
              disabled={busyUid === u.uid}
              onClick={() => setConfirmRemove(u)}
            >
              Remove
            </button>
          </>
        ),
    },
  ];

  return (
    <div className="app-shell">
      <AppSidebar />
      <div className="app-content">
        <AppTopbar title="Manage users" />
        <main className={styles.content}>
          <p className={styles.intro}>
            Approve or deny new signups below.{" "}
            {isSuperAdmin && (
              <>
                As the super admin you can also grant or revoke <strong>admin</strong> access.
              </>
            )}
          </p>

          {loading ? (
            <p className={styles.state}>Loading…</p>
          ) : error ? (
            <p className={`${styles.state} ${styles.error}`}>{error}</p>
          ) : (
            <>
              {requests.length > 0 && (
                <section className={styles.panel}>
                  <h3>
                    Pending requests <span className={styles.count}>{requests.length}</span>
                  </h3>
                  <ul className={styles.requestList}>
                    {requests.map((r) => (
                      <li key={r.uid}>
                        <div className={styles.who}>
                          <div className={styles.avatar}>{(r.email || "?").slice(0, 2).toUpperCase()}</div>
                          <div>
                            <div className={styles.email}>{r.displayName || r.email}</div>
                            <div className={styles.sub}>{r.email}</div>
                          </div>
                        </div>
                        <div className={styles.requestActions}>
                          <select
                            className={styles.deptSelect}
                            value={requestDept[r.uid] ?? ""}
                            disabled={busyUid === r.uid}
                            aria-label={`Department for ${r.email}`}
                            onChange={(e) =>
                              setRequestDept((prev) => ({
                                ...prev,
                                [r.uid]: e.target.value as Department | "",
                              }))
                            }
                          >
                            <option value="" disabled>
                              Choose department…
                            </option>
                            {DEPARTMENT_OPTIONS.map((d) => (
                              <option key={d.value} value={d.value}>
                                {d.label}
                              </option>
                            ))}
                          </select>
                          <button
                            className={styles.approve}
                            disabled={busyUid === r.uid || !requestDept[r.uid]}
                            title={!requestDept[r.uid] ? "Choose a department first" : undefined}
                            onClick={() => approve(r)}
                          >
                            Approve
                          </button>
                          <button className={styles.deny} disabled={busyUid === r.uid} onClick={() => deny(r)}>
                            Deny
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <DataTable
                columns={columns}
                rows={users}
                rowKey={(u) => u.uid}
                showSearch={false}
                emptyMessage="No users."
              />
            </>
          )}

          {confirmRemove && (
            <div
              className={styles.modalOverlay}
              role="dialog"
              aria-modal="true"
              onClick={() => setConfirmRemove(null)}
            >
              <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <h3 className={styles.modalTitle}>Remove user</h3>
                <p className={styles.modalBody}>
                  You are removing <strong>{confirmRemove.email}</strong> permanently. Do you wish to
                  continue the process?
                </p>
                <div className={styles.modalActions}>
                  <button className={styles.cancel} onClick={() => setConfirmRemove(null)}>
                    Cancel
                  </button>
                  <button className={styles.confirm} onClick={() => removeUser(confirmRemove)}>
                    Confirm
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
