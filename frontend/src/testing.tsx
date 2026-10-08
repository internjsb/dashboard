import { useEffect, useState } from "react";
import AppSidebar from "./components/AppSidebar";
import AppTopbar from "./components/AppTopbar";
import api from "./api/client";

// Test page (/testing, admins only): shows the first 100 rows of
// amazon.get_ledger_detail_view_data from Cloud SQL via GET /api/health/orders.
function Orders() {
  const [orders, setOrders] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // The shared API client uses the right backend (local or Heroku) and sends the sign-in token.
    api
      .get<Record<string, unknown>[]>("/health/orders", { timeout: 30000 })
      .then(({ data }) => setOrders(data))
      .catch((err) => setError(err.response?.data?.error || err.message))
      .finally(() => setLoading(false));
  }, []);

  const columns = orders.length ? Object.keys(orders[0]) : [];

  return (
    <div className="app-shell">
      <AppSidebar />
      <div className="app-content">
        <AppTopbar title="Testing — Cloud SQL" />
        <main style={{ padding: "28px 32px 48px" }}>
          {loading ? (
            <p>Loading…</p>
          ) : error ? (
            <p style={{ color: "var(--danger)" }}>{error}</p>
          ) : orders.length === 0 ? (
            <p>No rows.</p>
          ) : (
            <>
              <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>{orders.length} rows</p>
              <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
                <table style={{ borderCollapse: "collapse", fontSize: 12.5, background: "var(--surface)" }}>
                  <thead>
                    <tr>
                      {columns.map((c) => (
                        <th
                          key={c}
                          style={{ padding: "8px 10px", textAlign: "left", background: "var(--bg)", whiteSpace: "nowrap" }}
                        >
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o, i) => (
                      <tr key={i}>
                        {columns.map((c) => (
                          <td
                            key={c}
                            style={{ padding: "6px 10px", borderTop: "1px solid var(--border)", whiteSpace: "nowrap" }}
                          >
                            {o[c] == null ? "" : typeof o[c] === "object" ? JSON.stringify(o[c]) : String(o[c])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default Orders;
