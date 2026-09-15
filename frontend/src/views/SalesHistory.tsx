import { useEffect, useMemo, useState } from "react";
import AppSidebar from "../components/AppSidebar";
import AppTopbar from "../components/AppTopbar";
import StatCard from "../components/StatCard";
import RevenueChart from "../components/RevenueChart";
import CategoryDonut from "../components/CategoryDonut";
import DataTable, { type DataTableColumn } from "../components/DataTable";
import ExportCsvButton from "../components/ExportCsvButton";
import SegmentSearchBar from "../components/SegmentSearchBar";
import api from "../api/client";
import { matches } from "../utils/search";
import type { SalesHistoryData, TopItemRow } from "../types";
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

  const [query, setQuery] = useState("");
  const isSearching = query.trim().length > 0;

  const [countryQuery, setCountryQuery] = useState("");
  const filteredCountries = data.topCountries.filter((c) => matches(c.country, countryQuery));

  const matchedStats = useMemo(
    () => Object.entries(data.summary).filter(([, stat]) => matches(stat.label, query)),
    [data.summary, query],
  );

  const sectionText = {
    monthlySales: "monthly sales",
    salesByCountry: "sales by country",
    userGrowth: "userbase growth",
    topCountry: "top country",
    topItems: "most visited clicked items",
  };

  const show = {
    monthlySales: !isSearching || matches(sectionText.monthlySales, query),
    salesByCountry: !isSearching || matches(sectionText.salesByCountry, query),
    userGrowth: !isSearching || matches(sectionText.userGrowth, query),
    topCountry: !isSearching || matches(sectionText.topCountry, query),
    topItems: !isSearching || matches(sectionText.topItems, query),
  };

  const nothingFound =
    isSearching &&
    matchedStats.length === 0 &&
    !show.monthlySales &&
    !show.salesByCountry &&
    !show.userGrowth &&
    !show.topCountry &&
    !show.topItems;

  const itemColumns: DataTableColumn<TopItemRow>[] = [
    {
      key: "name",
      header: "Item",
      accessor: (i) => i.name,
      render: (item) => (
        <>
          <div className={styles.itemName}>{item.name}</div>
          <div className={styles.bar}>
            <span style={{ width: `${(item.views / maxViews) * 100}%` }} />
          </div>
        </>
      ),
    },
    { key: "views", header: "Views", accessor: (i) => i.views, align: "right", className: styles.numCol, render: (i) => num(i.views) },
    { key: "clicks", header: "Clicks", accessor: (i) => i.clicks, align: "right", className: styles.numCol, render: (i) => num(i.clicks) },
    {
      key: "addToCart",
      header: "Add to cart",
      accessor: (i) => i.addToCart,
      align: "right",
      className: styles.numCol,
      render: (i) => num(i.addToCart),
    },
    {
      key: "purchases",
      header: "Purchases",
      accessor: (i) => i.purchases,
      align: "right",
      className: styles.numCol,
      render: (i) => num(i.purchases),
    },
    {
      key: "cvr",
      header: "Conv. rate",
      accessor: (i) => (i.views ? (i.purchases / i.views) * 100 : 0),
      align: "right",
      className: styles.numCol,
      render: (i) => `${(i.views ? (i.purchases / i.views) * 100 : 0).toFixed(1)}%`,
    },
  ];

  return (
    <div className="app-shell">
      <AppSidebar />
      <div className="app-content">
        <AppTopbar title="Sales history" />
        <main className={styles.content}>
          <SegmentSearchBar
            value={query}
            onChange={setQuery}
            placeholder="Search this page...."
          />

          {loading ? (
            <p className={styles.state}>Loading…</p>
          ) : error ? (
            <p className={`${styles.state} ${styles.error}`}>{error}</p>
          ) : nothingFound ? (
            <p className={styles.state}>No cards match “{query}”.</p>
          ) : (
            <>
              {matchedStats.length > 0 && (
                <section className={styles.statsGrid}>
                  {matchedStats.map(([key, stat], i) => (
                    <StatCard key={key} {...stat} featured={!isSearching && i === 0} />
                  ))}
                </section>
              )}

              {(!isSearching || show.monthlySales || show.salesByCountry) && (
                <section className={isSearching ? undefined : styles.chartGrid}>
                  {show.monthlySales && (
                    <RevenueChart
                      data={data.monthlySales.map((m) => ({ month: m.month, value: m.revenue }))}
                      title="Monthly sales"
                      subtitle="Revenue · last 12 months"
                    />
                  )}
                  {show.salesByCountry && (
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
                  )}
                </section>
              )}

              {(!isSearching || show.userGrowth || show.topCountry) && (
                <section className={isSearching ? undefined : styles.chartGrid}>
                  {show.userGrowth && (
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
                  )}
                  {show.topCountry && (
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
                      <input
                        type="search"
                        className={styles.countrySearch}
                        placeholder="Search countries…"
                        value={countryQuery}
                        onChange={(e) => setCountryQuery(e.target.value)}
                        aria-label="Search countries"
                      />
                      {filteredCountries.length === 0 ? (
                        <p className={styles.countryEmpty}>No countries match “{countryQuery}”.</p>
                      ) : (
                        <ul className={styles.countryList}>
                          {filteredCountries.map((c) => (
                            <li key={c.country}>
                              <span className={styles.countryName}>{c.country}</span>
                              <span className={styles.countryValue}>{money(c.revenue)}</span>
                              <span className={styles.countryOrders}>{num(c.orders)} orders</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </section>
              )}

              {show.topItems && (
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
                  <DataTable
                    columns={itemColumns}
                    rows={data.topItems}
                    rowKey={(i) => i.name}
                    searchPlaceholder="Search items…"
                    emptyMessage="No items match your search."
                  />
                </section>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
