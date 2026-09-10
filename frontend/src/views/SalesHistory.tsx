import { useEffect, useState } from "react";
import AppSidebar from "../components/AppSidebar";
import AppTopbar from "../components/AppTopbar";
import StatCard from "../components/StatCard";
import RevenueChart from "../components/RevenueChart";
import CategoryDonut from "../components/CategoryDonut";
import ExportCsvButton from "../components/ExportCsvButton";
import api from "../api/client";
import type { SalesHistoryData } from "../types";
import styles from "./SalesHistory.module.css";

const EMPTY: SalesHistoryData = {
  summary: {},
  monthlySales: [],
  topItems: [],
  topCountries: [],
  userGrowth: [],
};

function money(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

function num(n: number): string {
  return n.toLocaleString();
}

export default function SalesHistory() {
  const [data, setData] = useState<SalesHistoryData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<SalesHistoryData>("/dashboard/sales-history");
        if (!cancelled) setData(res.data);
      } catch (err) {
        if (!cancelled) setError("Couldn't load sales history. Is the backend running?");
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const maxViews = Math.max(...data.topItems.map((i) => i.views), 1);
  const topCountry = data.topCountries[0];

  return (
    <div className="app-shell">
      <AppSidebar />
      <div className="app-content">
        <AppTopbar title="Sales history" />
        <main className={styles.content}>
          {loading ? (
            <p className={styles.state}>Loading…</p>
          ) : error ? (
            <p className={`${styles.state} ${styles.error}`}>{error}</p>
          ) : (
            <>
              <p className={styles.intro}>Trailing 12 months — sales, storefront traffic, top countries, and user growth.</p>

              <section className={styles.statsGrid}>
                {Object.entries(data.summary).map(([key, stat], i) => (
                  <StatCard key={key} {...stat} featured={i === 0} />
                ))}
              </section>

              <section className={styles.chartGrid}>
                <RevenueChart
                  data={data.monthlySales.map((m) => ({ month: m.month, value: m.revenue }))}
                  title="Monthly sales"
                  subtitle="Revenue · last 12 months"
                />
                <CategoryDonut
                  data={data.topCountries.map((c) => ({ category: c.country, value: c.revenue }))}
                  title="Sales by country"
                  subtitle="Revenue share · last 12 months"
                  action={
                    <ExportCsvButton
                      label="CSV"
                      filename="sales-by-country"
                      rows={data.topCountries}
                      columns={[
                        { header: "Country", value: (c) => c.country },
                        { header: "Revenue", value: (c) => c.revenue },
                        { header: "Orders", value: (c) => c.orders },
                      ]}
                    />
                  }
                />
              </section>

              <section className={styles.chartGrid}>
                <RevenueChart
                  data={data.userGrowth.map((g) => ({ month: g.month, value: g.total }))}
                  title="Userbase growth"
                  subtitle="Total registered users · last 12 months"
                  format="number"
                  action={
                    <ExportCsvButton
                      label="CSV"
                      filename="userbase-growth"
                      rows={data.userGrowth}
                      columns={[
                        { header: "Month", value: (g) => g.month },
                        { header: "Total users", value: (g) => g.total },
                        { header: "New users", value: (g) => g.added },
                      ]}
                    />
                  }
                />
                <div className={styles.card}>
                  <div className={styles.cardHead}>
                    <h3>Top country</h3>
                    <span className={styles.cardSub}>By revenue</span>
                  </div>
                  {topCountry && (
                    <div className={styles.bigStat}>
                      <span className={styles.bigStatValue}>{topCountry.country}</span>
                      <span className={styles.bigStatMeta}>
                        {money(topCountry.revenue)} · {num(topCountry.orders)} orders
                      </span>
                    </div>
                  )}
                  <ul className={styles.countryList}>
                    {data.topCountries.map((c) => (
                      <li key={c.country}>
                        <span className={styles.countryName}>{c.country}</span>
                        <span className={styles.countryValue}>{money(c.revenue)}</span>
                        <span className={styles.countryOrders}>{num(c.orders)} orders</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>

              <section className={styles.card}>
                <div className={`${styles.cardHead} ${styles.cardHeadRow}`}>
                  <div>
                    <h3>Most visited &amp; clicked items</h3>
                    <span className={styles.cardSub}>Storefront engagement · last 12 months</span>
                  </div>
                  <ExportCsvButton
                    filename="most-visited-items"
                    rows={data.topItems}
                    columns={[
                      { header: "Item", value: (i) => i.name },
                      { header: "Views", value: (i) => i.views },
                      { header: "Clicks", value: (i) => i.clicks },
                      { header: "Add to cart", value: (i) => i.addToCart },
                      { header: "Purchases", value: (i) => i.purchases },
                      {
                        header: "Conversion rate %",
                        value: (i) => (i.views ? ((i.purchases / i.views) * 100).toFixed(1) : "0.0"),
                      },
                    ]}
                  />
                </div>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th className={styles.numCol}>Views</th>
                        <th className={styles.numCol}>Clicks</th>
                        <th className={styles.numCol}>Add to cart</th>
                        <th className={styles.numCol}>Purchases</th>
                        <th className={styles.numCol}>Conv. rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topItems.map((item) => {
                        const cvr = item.views ? (item.purchases / item.views) * 100 : 0;
                        return (
                          <tr key={item.name}>
                            <td>
                              <div className={styles.itemName}>{item.name}</div>
                              <div className={styles.bar}>
                                <span style={{ width: `${(item.views / maxViews) * 100}%` }} />
                              </div>
                            </td>
                            <td className={styles.numCol}>{num(item.views)}</td>
                            <td className={styles.numCol}>{num(item.clicks)}</td>
                            <td className={styles.numCol}>{num(item.addToCart)}</td>
                            <td className={styles.numCol}>{num(item.purchases)}</td>
                            <td className={styles.numCol}>{cvr.toFixed(1)}%</td>
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
