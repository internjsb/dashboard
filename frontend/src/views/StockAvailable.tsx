import AppSidebar from "../components/AppSidebar";
import AppTopbar from "../components/AppTopbar";
import ExportCsvButton from "../components/ExportCsvButton";
import { useStock } from "../hooks/useStock";
import type { StockStatus } from "../types";
import styles from "./StockAvailable.module.css";

const STATUS_LABEL: Record<StockStatus, string> = {
  ok: "In stock",
  low: "Low",
  out: "Out of stock",
};

function num(n: number): string {
  return n.toLocaleString();
}

export default function StockAvailable() {
  const { data, lowItems, loading, error, reload } = useStock();

  const byItem = data?.byItem ?? [];
  const byCountry = data?.byCountry ?? [];
  const totalOnHand = byCountry.reduce((s, c) => s + c.available, 0);

  return (
    <div className="app-shell">
      <AppSidebar />
      <div className="app-content">
        <AppTopbar title="Stock available" />
        <main className={styles.content}>
          <div className={styles.head}>
            <p className={styles.intro}>On-hand inventory by item and by fulfilment country.</p>
            <button className={styles.refresh} onClick={reload} disabled={loading}>
              Refresh
            </button>
          </div>

          {loading ? (
            <p className={styles.state}>Loading…</p>
          ) : error ? (
            <p className={`${styles.state} ${styles.error}`}>{error}</p>
          ) : (
            <>
              {lowItems.length > 0 && (
                <div className={styles.alert} role="alert">
                  <span className={styles.alertIcon} aria-hidden="true">
                    !
                  </span>
                  <div>
                    <strong>
                      {lowItems.length} item{lowItems.length > 1 ? "s" : ""} need attention
                    </strong>
                    <p className={styles.alertBody}>
                      {lowItems
                        .map((i) => `${i.finish} (${i.status === "out" ? "out of stock" : `${i.available} left`})`)
                        .join(", ")}
                    </p>
                  </div>
                </div>
              )}

              <section className={styles.card}>
                <div className={styles.cardHead}>
                  <div>
                    <h3>Items</h3>
                    <span className={styles.cardSub}>
                      Flagged low at or below each item's reorder level
                    </span>
                  </div>
                  <ExportCsvButton
                    filename="stock-by-item"
                    rows={byItem}
                    columns={[
                      { header: "Item", value: (i) => i.finish },
                      { header: "Available", value: (i) => i.available },
                      { header: "Inbound", value: (i) => i.inbound },
                      { header: "Reorder level", value: (i) => i.reorderLevel },
                      { header: "Status", value: (i) => STATUS_LABEL[i.status] },
                    ]}
                  />
                </div>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th className={styles.numCol}>Available</th>
                        <th className={styles.numCol}>Inbound</th>
                        <th className={styles.numCol}>Reorder level</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byItem.map((i) => (
                        <tr key={i.finish} className={i.status !== "ok" ? styles.rowFlag : ""}>
                          <td>{i.finish}</td>
                          <td className={styles.numCol}>{num(i.available)}</td>
                          <td className={styles.numCol}>{i.inbound ? num(i.inbound) : "—"}</td>
                          <td className={styles.numCol}>{num(i.reorderLevel)}</td>
                          <td>
                            <span className={`${styles.pill} ${styles[i.status]}`}>
                              {STATUS_LABEL[i.status]}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className={styles.card}>
                <div className={styles.cardHead}>
                  <div>
                    <h3>Stock by country</h3>
                    <span className={styles.cardSub}>
                      {num(totalOnHand)} units on hand across {byCountry.length} warehouses
                    </span>
                  </div>
                  <ExportCsvButton
                    filename="stock-by-country"
                    rows={byCountry}
                    columns={[
                      { header: "Country", value: (c) => c.country },
                      { header: "Warehouse", value: (c) => c.warehouse },
                      { header: "Available", value: (c) => c.available },
                    ]}
                  />
                </div>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Country</th>
                        <th>Warehouse</th>
                        <th className={styles.numCol}>Available</th>
                        <th className={styles.numCol}>Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byCountry.map((c) => {
                        const share = totalOnHand ? (c.available / totalOnHand) * 100 : 0;
                        return (
                          <tr key={c.country}>
                            <td>{c.country}</td>
                            <td className={styles.muted}>{c.warehouse}</td>
                            <td className={styles.numCol}>
                              {c.available === 0 ? (
                                <span className={`${styles.pill} ${styles.out}`}>Out</span>
                              ) : (
                                num(c.available)
                              )}
                            </td>
                            <td className={styles.numCol}>{share.toFixed(0)}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
