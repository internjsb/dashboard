import { useEffect, useState } from "react";
import axios from "axios";
import AppSidebar from "../components/AppSidebar";
import AppTopbar from "../components/AppTopbar";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { PAGE_LABEL, type PageKey } from "../lib/pageAccess";
import type { UserRecord, Department } from "../types";
import styles from "./PageManagement.module.css";

const DEPARTMENT_LABEL: Record<Department, string> = {
  super_user: "Super user",
  sales: "Sales",
  supplychain: "Supply chain",
  finance: "Finance",
};

const PAGES: PageKey[] = [
  "dashboard",
  "sales_history",
  "sale_report",
  "stock_available",
  "inventory",
  "finance",
  "products",
  "product_listings",
];

function errorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string } | undefined;
    return data?.error || fallback;
  }
  return fallback;
}

export default function PageManagement() {
  const { user } = useAuth();
  const currentUid = user?.uid;

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get<{ users: UserRecord[] }>("/users");
      setUsers(data.users);
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

  // No department and not an admin -> nothing meaningful to show in Department or
  // grant yet (e.g. still pending, or denied). Keep the matrix to accounts
  // that actually have something assigned.
  const visibleUsers = users.filter((u) => u.isSuperAdmin || u.role === "admin" || !!u.department);

  async function toggle(target: UserRecord, page: PageKey, allowed: boolean) {
    const key = `${target.uid}:${page}`;
    setBusyKey(key);
    try {
      await api.patch(`/users/${target.uid}/page-access`, { page, allowed });
      setUsers((prev) =>
        prev.map((u) =>
          u.uid === target.uid ? { ...u, pageAccess: { ...u.pageAccess, [page]: allowed } } : u,
        ),
      );
    } catch (err) {
      window.alert(errorMessage(err, "Failed to update page access"));
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="app-shell">
      <AppSidebar />
      <div className="app-content">
        <AppTopbar title="User page management" />
        <main className={styles.content}>
          {loading ? (
            <p className={styles.state}>Loading…</p>
          ) : error ? (
            <p className={`${styles.state} ${styles.error}`}>{error}</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th rowSpan={2} className={styles.usersHead}>
                      Users
                    </th>
                    <th rowSpan={2} className={styles.rolesHead}>
                      Department
                    </th>
                    <th colSpan={PAGES.length} className={styles.pagesHead}>
                      Pages
                    </th>
                  </tr>
                  <tr>
                    {PAGES.map((page) => (
                      <th key={page} className={styles.pageCol}>
                        {PAGE_LABEL[page]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleUsers.length === 0 ? (
                    <tr>
                      <td className={styles.empty} colSpan={2 + PAGES.length}>
                        No users.
                      </td>
                    </tr>
                  ) : (
                    visibleUsers.map((u) => {
                      const isSelf = u.uid === currentUid;
                      return (
                        <tr key={u.uid}>
                          <td className={styles.userCell}>
                            <div className={styles.roleCellInner}>
                              <span>{u.email}</span>
                              {u.isSuperAdmin ? (
                                <span className={styles.adminBadge}>Super admin</span>
                              ) : u.role === "admin" ? (
                                <span className={styles.adminBadge}>Admin</span>
                              ) : (
                                <span className={styles.userBadge}>User</span>
                              )}
                            </div>
                          </td>
                          <td className={styles.roleCell}>
                            {u.isSuperAdmin ? "super user" : u.department ? DEPARTMENT_LABEL[u.department] : "—"}
                          </td>
                          {PAGES.map((page) => {
                            const checked = u.isSuperAdmin ? true : !!u.pageAccess?.[page];
                            const busy = busyKey === `${u.uid}:${page}`;
                            return (
                              <td key={page} className={styles.pageCol}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={u.isSuperAdmin || isSelf || busy}
                                  title={
                                    u.isSuperAdmin
                                      ? "The super admin always has every page"
                                      : isSelf
                                        ? "You can't change your own page access"
                                        : undefined
                                  }
                                  onChange={(e) => toggle(u, page, e.target.checked)}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
