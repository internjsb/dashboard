import { useEffect, useMemo, useState } from "react";
import AppSidebar from "../components/AppSidebar";
import AppTopbar from "../components/AppTopbar";
import StatCard from "../components/StatCard";
import RevenueChart from "../components/RevenueChart";
import CategoryDonut from "../components/CategoryDonut";
import DataTable, { type DataTableColumn, type DataTableFilter } from "../components/DataTable";
import ExportCsvButton from "../components/ExportCsvButton";
import SegmentSearchBar from "../components/SegmentSearchBar";
import api from "../api/client";
import { matches } from "../utils/search";
import { MARKETPLACES, inMarketplace, useMarketplace } from "../hooks/useMarketplace";
import styles from "./SalesHistory.module.css";

// The fields this page uses from /health/sale_report (same data as the Sale Report page).
interface SaleReportRow {
  purchase_date: string | null; // "23/09/26"
  order_id: string;
  sku: string;
  item_code: string | null;
  qty: number | string;
  price_wo_tax: number | string;
  marketplace_id: string | null;
  currency: string | null;
}

// One order line, ready to add up.
interface SaleLine {
  day: string; // "2026-09-23" (purchase date)
  marketplace_id: string;
  country: string;
  currency: string;
  order_id: string;
  sku: string;
  item_code: string | null;
  units: number;
  revenue: number; // price w/o tax, in the line's own currency
  revenue_usd: number | null; // null when there was no rate for that day
}

// "23/09/26" -> "2026-09-23" (same as sortableDate in SaleReport).
function sortableDate(value: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{2})$/.exec(value.trim());
  return m ? `20${m[3]}-${m[2]}-${m[1]}` : value;
}

function monthLabel(month: string): string{
  const [y, m] = month.split("-").map(Number);
  return new Date(y,m -1, 1).toLocaleDateString(undefined, {month: "long", year: "numeric"});
}

// Fallback when a row has no currency: the marketplace's own (same list as SaleReport).
const MARKETPLACE_CURRENCY: Record<string, string> = {
  ATVPDKIKX0DER: "USD", A1VC38T7YXB528: "JPY", A2EUQ1WTGCTBG2: "CAD", A1AM78C64UM0Y8: "MXN",
  A2Q3Y263D00KWC: "BRL", A1F83G8C2ARO7P: "GBP", A1PA6795UKMFR9: "EUR", A13V1IB3VIYZZH: "EUR",
  APJ6JRA9NG5V4: "EUR", A1RKKUPIHCS9HS: "EUR", A1805IZSGTT6HS: "EUR", AMEN7PMS3EDWL: "EUR",
  A28R8C7NBKEWEA: "EUR", A2NODRKZP88ZB9: "SEK", A1C3SOZRARQ6R3: "PLN", A33AVAJ2PDY3EV: "TRY",
  A2VIGQ35RCS4UG: "AED", A17E79C6D8DWNP: "SAR", A39IBJ37TRP1C6: "AUD",
};

function countryName(marketplaceId: string): string {
  return MARKETPLACES.find((m) => m.code === marketplaceId)?.label ?? marketplaceId;
}

interface StatItem {
  label: string;
  value: number;
  delta: number;
  unit?: "count" | "currency" | "percent";
}

interface CountryRow {
  country: string;
  currencyCode: string;
  revenue: number; // USD
  orders: number;
}

interface TopItemRow {
  key: string;
  sku: string;
  dtiItemCode: string;
  name: string;
  country: string;
  units: number;
  orders: number;
  revenue: number; // USD
}

// Still mock (from /dashboard/sales-history): dashboard users aren't in the database.
interface UserGrowthPoint {
  month: string;
  total: number;
  added: number;
}

function shortDay(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// "2026-09-23" moved by n days, still as "YYYY-MM-DD".
function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function money(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

function num(n: number): string {
  return n.toLocaleString();
}

// % change from `prev` to `cur`, one decimal; 0 when there's nothing to compare to.
function pctChange(cur: number, prev: number): number {
  return prev ? Math.round(((cur - prev) / prev) * 1000) / 10 : 0;
}

export default function SalesHistory() {
  const [lines, setLines] = useState<SaleLine[]>([]);
  const [userGrowth, setUserGrowth] = useState<UserGrowthPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { code } = useMarketplace();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<{ rows: SaleReportRow[] }>("/health/sale_report");
        const base = (data.rows ?? [])
          .filter((r) => r.purchase_date)
          .map((r) => ({
            day: sortableDate(r.purchase_date!),
            marketplace_id: r.marketplace_id ?? "",
            country: countryName(r.marketplace_id ?? ""),
            currency: r.currency || MARKETPLACE_CURRENCY[r.marketplace_id ?? ""] || "USD",
            order_id: r.order_id,
            sku: r.sku,
            item_code: r.item_code,
            units: Number(r.qty) || 0,
            revenue: Number(r.price_wo_tax) || 0,
          }));

        // Rates (per 1 USD) for each day that has a non-USD sale.
        // Long timeout: the first load may wait on Twelve Data's per-minute limit.
        const nonUsd = base.filter((l) => l.currency !== "USD");
        let rates: Record<string, Record<string, number>> = {};
        if (nonUsd.length) {
          try {
            const res = await api.get<{ rates: Record<string, Record<string, number>> }>("/health/exchange_rates", {
              params: {
                dates: [...new Set(nonUsd.map((l) => l.day))].join(","),
                currencies: [...new Set(nonUsd.map((l) => l.currency))].join(","),
              },
              timeout: 90000,
            });
            rates = res.data.rates ?? {};
          } catch (err) {
            // No rates: non-USD lines just stay out of the USD totals.
            console.error(err);
          }
        }

        const withUsd: SaleLine[] = base.map((l) => {
          const rate = l.currency === "USD" ? 1 : rates[l.day]?.[l.currency];
          return { ...l, revenue_usd: rate ? l.revenue / rate : null };
        });
        if (!cancelled) setLines(withUsd);
      } catch (err) {
        if (!cancelled) setError("Couldn't load sales history. Is the backend running?");
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    // Userbase growth is still mock data; the page works without it.
    api
      .get<{ userGrowth?: UserGrowthPoint[] }>("/dashboard/sales-history")
      .then((res) => {
        if (!cancelled) setUserGrowth(res.data.userGrowth ?? []);
      })
      .catch((err) => console.error(err));
    return () => {
      cancelled = true;
    };
  }, []);

  // Lines for the marketplace picked in the top bar ("" = all).
  const marketLines = useMemo(() => lines.filter((l) => inMarketplace(code, l.marketplace_id)), [lines, code]);

  // The data stops before today, so "last 30 days" means the 30 days up to the newest sale.
  const lastDay = useMemo(
    () => marketLines.reduce((max, l) => (l.day > max ? l.day : max), "") || new Date().toISOString().slice(0, 10),
    [marketLines],
  );
  const from30 = addDays(lastDay, -29);
  const fromPrev30 = addDays(lastDay, -59);
  const from12m = addDays(lastDay, -364);

  // Lines whose price couldn't be converted to USD (no rate) — left out of USD totals.
  const unconverted = marketLines.filter((l) => l.revenue_usd == null).length;

  const last30Days = useMemo(() => {
    const byDay = new Map<string, { date: string; revenue: number; units: number }>();
    for (let i = 0; i < 30; i++) {
      const date = addDays(from30, i);
      byDay.set(date, { date, revenue: 0, units: 0 });
    }
    for (const l of marketLines) {
      const d = byDay.get(l.day);
      if (!d) continue;
      d.revenue += l.revenue_usd ?? 0;
      d.units += l.units;
    }
    return [...byDay.values()];
  }, [marketLines, from30]);

  const summary = useMemo<Record<string, StatItem>>(() => {
    const totalsFor = (from: string, to: string) => {
      const inRange = marketLines.filter((l) => l.day >= from && l.day <= to);
      const revenue = inRange.reduce((sum, l) => sum + (l.revenue_usd ?? 0), 0);
      const units = inRange.reduce((sum, l) => sum + l.units, 0);
      const orders = new Set(inRange.map((l) => l.order_id)).size;
      return { revenue, units, orders, aov: orders ? revenue / orders : 0 };
    };
    const cur = totalsFor(from30, lastDay);
    const prev = totalsFor(fromPrev30, addDays(from30, -1));
    return {
      revenue: { label: "Revenue (USD) · 30 days", value: Math.round(cur.revenue), delta: pctChange(cur.revenue, prev.revenue), unit: "currency" },
      units: { label: "Units sold · 30 days", value: cur.units, delta: pctChange(cur.units, prev.units) },
      orders: { label: "Orders · 30 days", value: cur.orders, delta: pctChange(cur.orders, prev.orders) },
      aov: { label: "Avg order value (USD)", value: Math.round(cur.aov), delta: pctChange(cur.aov, prev.aov), unit: "currency" },
    };
  }, [marketLines, from30, fromPrev30, lastDay]);

  // Last 12 months, for the country and item breakdowns.
  const yearLines = useMemo(() => marketLines.filter((l) => l.day >= from12m), [marketLines, from12m]);

  const topCountries = useMemo<CountryRow[]>(() => {
    const byCountry = new Map<string, { row: CountryRow; orderIds: Set<string>; currencies: Map<string, number> }>();
    for (const l of yearLines) {
      let c = byCountry.get(l.country);
      if (!c) {
        c = { row: { country: l.country, currencyCode: "", revenue: 0, orders: 0 }, orderIds: new Set(), currencies: new Map() };
        byCountry.set(l.country, c);
      }
      c.row.revenue += l.revenue_usd ?? 0;
      c.orderIds.add(l.order_id);
      c.currencies.set(l.currency, (c.currencies.get(l.currency) ?? 0) + 1);
    }
    return [...byCountry.values()]
      .map(({ row, orderIds, currencies }) => ({
        ...row,
        // The currency most of that country's sales are in (US also has a few MXN/CAD orders).
        currencyCode: [...currencies.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "",
        revenue: Math.round(row.revenue * 100) / 100,
        orders: orderIds.size,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [yearLines]);

  const topItems = useMemo<TopItemRow[]>(() => {
    const byItem = new Map<string, { row: TopItemRow; orderIds: Set<string> }>();
    for (const l of yearLines) {
      const key = `${l.marketplace_id}|${l.sku}`;
      let it = byItem.get(key);
      if (!it) {
        it = {
          row: {
            key,
            sku: l.sku,
            dtiItemCode: l.item_code ?? "—",
            name: l.item_code ?? l.sku,
            country: l.country,
            units: 0,
            orders: 0,
            revenue: 0,
          },
          orderIds: new Set(),
        };
        byItem.set(key, it);
      }
      it.row.units += l.units;
      it.row.revenue += l.revenue_usd ?? 0;
      it.orderIds.add(l.order_id);
    }
    return [...byItem.values()]
      .map(({ row, orderIds }) => ({ ...row, revenue: Math.round(row.revenue * 100) / 100, orders: orderIds.size }))
      .sort((a, b) => b.units - a.units || b.revenue - a.revenue);
  }, [yearLines]);

  const maxUnits = Math.max(...topItems.map((i) => i.units), 1);
  const topCountry = topCountries[0];

  const [query, setQuery] = useState("");
  const isSearching = query.trim().length > 0;

  const [countryQuery, setCountryQuery] = useState("");
  const filteredCountries = topCountries.filter((c) => matches(c.country, countryQuery));

  const matchedStats = useMemo(
    () => Object.entries(summary).filter(([, stat]) => matches(stat.label, query)),
    [summary, query],
  );

  const sectionText = {
    last30Days: "last 30 days sales units sold",
    salesByCountry: "sales by country",
    userGrowth: "userbase growth",
    topCountry: "top country",
    topItems: "top selling items best sellers",
  };

  const show = {
    last30Days: !isSearching || matches(sectionText.last30Days, query),
    salesByCountry: !isSearching || matches(sectionText.salesByCountry, query),
    userGrowth: !isSearching || matches(sectionText.userGrowth, query),
    topCountry: !isSearching || matches(sectionText.topCountry, query),
    topItems: !isSearching || matches(sectionText.topItems, query),
  };

  const nothingFound =
    isSearching &&
    matchedStats.length === 0 &&
    !show.last30Days &&
    !show.salesByCountry &&
    !show.userGrowth &&
    !show.topCountry &&
    !show.topItems;

  const rangeText = `${shortDay(from30)} – ${shortDay(lastDay)}`;

  const itemColumns: DataTableColumn<TopItemRow>[] = [
    { key: "sku", header: "SKU", accessor: (i) => i.sku },
    { key: "dtiItemCode", header: "Product Item Code", accessor: (i) => i.dtiItemCode },
    // {
    //   key: "name",
    //   header: "Item Name",
    //   accessor: (i) => i.name,
    //   render: (item) => (
    //     <>
    //       <div className={styles.itemName}>{item.name}</div>
    //       <div className={styles.bar}>
    //         <span style={{ width: `${(item.units / maxUnits) * 100}%` }} />
    //       </div>
    //     </>
    //   ),
    // },
    { key: "country", header: "Country", accessor: (i) => i.country },
    { key: "units", header: "Units sold", accessor: (i) => i.units, align: "right", className: styles.numCol, render: (i) => num(i.units) },
    { key: "orders", header: "Orders", accessor: (i) => i.orders, align: "right", className: styles.numCol, render: (i) => num(i.orders) },
    {
      key: "revenue",
      header: "Revenue (USD)",
      accessor: (i) => i.revenue,
      align: "right",
      className: styles.numCol,
      render: (i) => money(i.revenue),
    },
    {
      key: "avg",
      header: "Avg price (USD)",
      accessor: (i) => (i.units ? i.revenue / i.units : 0),
      align: "right",
      className: styles.numCol,
      render: (i) => money(i.units ? i.revenue / i.units : 0),
    },
  ];

  const itemFilters: DataTableFilter<TopItemRow>[] = [
    {
      key: "dtiItemCode",
      label: "Product Item Code",
      accessor: (i) => i.dtiItemCode,
      options: Array.from(new Set(topItems.map((i) => i.dtiItemCode)))
        .sort()
        .map((c) => ({ value: c, label: c })),
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
              {unconverted > 0 && (
                <p className={styles.state}>
                  {num(unconverted)} order lines have no exchange rate yet and are left out of the USD totals.
                </p>
              )}

              {matchedStats.length > 0 && (
                <section className={styles.statsGrid}>
                  {matchedStats.map(([key, stat], i) => (
                    <StatCard key={key} {...stat} featured={!isSearching && i === 0} />
                  ))}
                </section>
              )}

              {(!isSearching || show.last30Days) && (
                <section className={isSearching ? undefined : styles.chartGrid}>
                  {show.last30Days && (
                    <RevenueChart
                      data={last30Days.map((d) => ({ month: shortDay(d.date), value: Math.round(d.revenue) }))}
                      title="Sales — last 30 days"
                      subtitle={`Revenue (USD) · ${rangeText}`}
                      headline="total"
                    />
                  )}
                  {show.last30Days && (
                    <RevenueChart
                      data={last30Days.map((d) => ({ month: shortDay(d.date), value: d.units }))}
                      title="Units sold — last 30 days"
                      subtitle={`Units · ${rangeText}`}
                      format="number"
                      headline="total"
                    />
                  )}
                </section>
              )}

              {(!isSearching || show.salesByCountry) && (
                <section className={isSearching ? undefined : styles.chartGrid}>
                  {show.salesByCountry && (
                    <CategoryDonut
                      data={topCountries.map((c) => ({ category: c.country, value: Math.round(c.revenue) }))}
                      title="Sales by country"
                      subtitle="Revenue share (USD) · last 12 months"
                      action={
                        <ExportCsvButton
                          label="CSV"
                          filename="sales-by-country"
                          rows={topCountries}
                          columns={[
                            { header: "Country", value: (c) => c.country },
                            { header: "Currency", value: (c) => c.currencyCode },
                            { header: "Revenue (USD)", value: (c) => c.revenue },
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
                  {/* {show.userGrowth && (
                    <RevenueChart
                      data={userGrowth.map((g) => ({ month: g.month, value: g.total }))}
                      title="Userbase growth"
                      subtitle="Total registered users · last 12 months"
                      format="number"
                      action={
                        <ExportCsvButton
                          label="CSV"
                          filename="userbase-growth"
                          rows={userGrowth}
                          columns={[
                            { header: "Month", value: (g) => g.month },
                            { header: "Total users", value: (g) => g.total },
                            { header: "New users", value: (g) => g.added },
                          ]}
                        />
                      }
                    />
                  )} */}
                  {show.topCountry && (
                    <div className={styles.card}>
                      <div className={styles.cardHead}>
                        <h3>Top country</h3>
                        <span className={styles.cardSub}>By revenue (USD) · last 12 months</span>
                      </div>
                      {topCountry && (
                        <div className={styles.bigStat}>
                          <span className={styles.bigStatValue}>
                            {topCountry.country} <span className={styles.countryCode}>{topCountry.currencyCode}</span>
                          </span>
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
                              <span className={styles.countryName}>
                                {c.country} <span className={styles.countryCode}>{c.currencyCode}</span>
                              </span>
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
                      <h3>Top selling items</h3>
                      <span className={styles.cardSub}>By units sold · last 12 months</span>
                    </div>
                    <ExportCsvButton
                      filename="top-selling-items"
                      rows={topItems}
                      columns={[
                        { header: "SKU", value: (i) => i.sku },
                        { header: "Product Item Code", value: (i) => i.dtiItemCode },
                        // { header: "Item Name", value: (i) => i.name },
                        { header: "Country", value: (i) => i.country },
                        { header: "Units sold", value: (i) => i.units },
                        { header: "Orders", value: (i) => i.orders },
                        { header: "Revenue (USD)", value: (i) => i.revenue },
                      ]}
                    />
                  </div>
                  <DataTable
                    columns={itemColumns}
                    rows={topItems}
                    rowKey={(i) => i.key}
                    searchPlaceholder="Search items…"
                    filters={itemFilters}
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
