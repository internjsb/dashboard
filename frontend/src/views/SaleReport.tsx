import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Download, Search, X } from "lucide-react";
import AppSidebar from "../components/AppSidebar";
import AppTopbar from "../components/AppTopbar";
import api from "../api/client";
import { matches } from "../utils/search";
import { inMarketplace, useMarketplace } from "../hooks/useMarketplace";
import styles from "./SaleReport.module.css";
import RevenueChart from "../components/RevenueChart";

// Rows-per-page choices; 0 means "All". Always starts at 10.
const PAGE_SIZE_OPTIONS = [10, 50, 100, 0];

// One row from GET /health/sale_report — the query returns exactly these
// columns (no NULLs, prices as numbers, dates as YYYY-MM-DD).
interface SaleReport {
  id: string;
  purchase_date: string;
  item_code: string;
  set_: string;
  qty: number;
  product_sale_price: number;
  unit_price: number;
  order_id: string;
  fulfillment: string;
  shipped_date: string;
  marketplace_id: string | null; // not shown; used by the top-bar marketplace filter
}

type SortKey = Exclude<keyof SaleReport, "id" | "marketplace_id">;
type SortDir = "asc" | "desc";

// Column order and headings follow the accounting department's "Format for
// Sales Report" (the CSV export uses the same, for import into the ERP).
const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: "purchase_date", label: "Purchase Date" },
  { key: "item_code", label: "Product Item Code" },
  { key: "set_", label: "Set" },
  { key: "qty", label: "QTY", numeric: true },
  { key: "product_sale_price", label: "Product Sales Price", numeric: true },
  { key: "unit_price", label: "Unit price (Sales/Qty)", numeric: true },
  { key: "order_id", label: "Order id" },
  { key: "fulfillment", label: "Fulfillment" },
  { key: "shipped_date", label: "Order Fulfillment Date" },
];

// Plain two-decimal amounts (20.00, 7.50) — no currency symbol, per the format.
function money(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Stat-tile values: full precision while small, compacted once they get long.
function compactMoney(n: number): string {
  return Math.abs(n) >= 100_000
    ? n.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 1 })
    : money(n);
}

function compactCount(n: number): string {
  return n >= 10_000 ? n.toLocaleString(undefined, { notation: "compact", maximumFractionDigits: 1 }) : n.toLocaleString();
}

function formatDate(value: string): string {
  return value || "—";
}

// The API sends dates as DD/MM/YY ("24/09/26"); compare and sort them as
// YYYY-MM-DD ("2026-09-24"), which orders correctly as text and matches what
// <input type="date"> gives. Anything else is returned unchanged.
function sortableDate(value: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{2})$/.exec(value.trim());
  return m ? `20${m[3]}-${m[2]}-${m[1]}` : value;
}

const DATE_KEYS: ReadonlySet<SortKey> = new Set(["purchase_date", "shipped_date"]);

// yyyy-mm-dd in local time (what <input type="date"> uses).
function isoDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function shortDay(iso: string): string{
  const[y,m,d] = iso.split("-").map(Number);
  return new Date(y, m-1, d).toLocaleDateString(undefined, {month: "short", day: "numeric"});
}

const DATE_PRESETS: { label: string; range: () => [string, string] }[] = [
  {
    label: "Last 7 days",
    range: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 6);
      return [isoDay(start), isoDay(end)];
    },
  },
  {
    label: "Last 30 days",
    range: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 29);
      return [isoDay(start), isoDay(end)];
    },
  },
  {
    label: "This month",
    range: () => {
      const now = new Date();
      return [isoDay(new Date(now.getFullYear(), now.getMonth(), 1)), isoDay(now)];
    },
  },
];

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Export in the exact accounting format: same columns and headings, dates as
// YYYY-MM-DD, amounts with two decimals, blank Set left blank.
function csvValue(r: SaleReport, key: SortKey): string | number {
  if (key === "product_sale_price" || key === "unit_price") return r[key].toFixed(2);
  return r[key];
}

function downloadCsv(rows: SaleReport[]) {
  const header = COLUMNS.map((c) => c.label);
  const lines = rows.map((r) => COLUMNS.map((c) => csvCell(csvValue(r, c.key))).join(","));
  const blob = new Blob([[header.map(csvCell).join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sales-report-${isoDay(new Date())}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SaleReport() {
  const [rows, setRows] = useState<SaleReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "shipped_date", dir: "desc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<{ rows: SaleReport[] }>("/health/sale_report");
        // Postgres sends numeric columns (item_price, round(...)) as strings —
        // turn them into numbers so totals add up instead of joining text.
        if (!cancelled)
          setRows(
            data.rows.map((r) => ({
              ...r,
              qty: Number(r.qty) || 0,
              product_sale_price: Number(r.product_sale_price) || 0,
              unit_price: Number(r.unit_price) || 0,
            })),
          );
      } catch (err) {
        if (!cancelled) setError("Couldn't load the sales report. Is the backend running?");
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const { code } = useMarketplace();
  const filtered = useMemo(() => {
    const out = rows
      .filter((r) => inMarketplace(code, r.marketplace_id))
      // Date range is by order fulfillment (shipped) date; rows without one only show when no range is set.
      .filter((r) => !fromDate || (!!r.shipped_date && sortableDate(r.shipped_date) >= fromDate))
      .filter((r) => !toDate || (!!r.shipped_date && sortableDate(r.shipped_date) <= toDate))
      .filter((r) => matches(`${r.item_code} ${r.set_} ${r.order_id} ${r.fulfillment}`, query));
    const dir = sort.dir === "asc" ? 1 : -1;
    return out.sort((a, b) => {
      const av = DATE_KEYS.has(sort.key) ? sortableDate(String(a[sort.key])) : a[sort.key];
      const bv = DATE_KEYS.has(sort.key) ? sortableDate(String(b[sort.key])) : b[sort.key];
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return cmp * dir;
    });
  }, [rows, fromDate, toDate, query, sort]);

  // Totals for whatever the filters currently match (not just this page).
  const totals = useMemo(() => {
    const sales = filtered.reduce((sum, r) => sum + r.product_sale_price, 0);
    const orders = new Set(filtered.map((r) => r.order_id)).size;
    return {
      orders,
      units: filtered.reduce((sum, r) => sum + r.qty, 0),
      sales,
      avgOrder: orders ? sales / orders : 0,
    };
  }, [filtered]);

  const last30Days = useMemo(() => {

    const marketRows = rows.filter((r) => r.purchase_date && inMarketplace(code, r.marketplace_id));

    const newest = marketRows.reduce((max, r)=> {
      const day = sortableDate(r.purchase_date);
      return day > max ? day : max;
    }, "");

    if(!newest) return[];

    const days = Array.from({ length: 30}, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (29-i));
      return {date : isoDay(d), sales: 0, units: 0};
    });

    const byDate = new Map(days.map((d) => [d.date, d]));
    for (const r of rows){
      if(!r.purchase_date || !inMarketplace(code, r.marketplace_id))continue;
      const day = byDate.get(sortableDate(r.purchase_date));
      if (day){
        day.sales += r.product_sale_price;
        day.units += r.qty;
      }
    }

    return days;
  }, [rows, code]);

  // A new search, date range, sort or page size changes which rows land on
  // which page, so whatever page we were on no longer means the same thing.
  useEffect(() => {
    setPage(1);
  }, [query, fromDate, toDate, sort, pageSize]);

  const perPage = pageSize || filtered.length || 1;
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const firstIndex = (currentPage - 1) * perPage;
  const paged = filtered.slice(firstIndex, firstIndex + perPage);
  const hasFilters = !!(query || fromDate || toDate);

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "shipped_date" ? "desc" : "asc" },
    );
  }

  function clearFilters() {
    setQuery("");
    setFromDate("");
    setToDate("");
  }

  const stats = [
    { label: "Orders", value: compactCount(totals.orders) },
    { label: "Units sold", value: compactCount(totals.units) },
    { label: "Total sales", value: compactMoney(totals.sales) },
    { label: "Avg order value", value: compactMoney(totals.avgOrder) },
  ];

  return (
    <div className="app-shell">
      <AppSidebar />
      <div className="app-content">
        <AppTopbar title="Sales report" />
        <main className={styles.content}>
          <section className={styles.stats} aria-label="Totals for the current filters">
            {stats.map((s) => (
              <div key={s.label} className={styles.stat}>
                <span className={styles.statLabel}>{s.label}</span>
                <span className={styles.statValue}>{loading ? "—" : s.value}</span>
              </div>
            ))}
          </section>
          <p className={styles.statsNote}>
            {hasFilters ? "Totals for the rows matching your filters." : "Totals for all rows."}
          </p>
          
          <section className={styles.chartGrid}>
            {/* <RevenueChart
              data = {last30Days.map((d) => ({month: shortDay(d.date), value: d.sales}))}
              title="Sales - last 30 days"
              subtitle={last30Days.length ? `${shortDay(last30Days[0].date)} – ${shortDay(last30Days[29].date)}` : "No sales yet"}
              headline="total"
            /> */}

          </section>  
          <section className={styles.card}>
            <div className={styles.toolbar}>
              <div className={styles.search}>
                <Search className={styles.searchIcon} size={16} aria-hidden="true" />
                <input
                  type="search"
                  placeholder="Search item code, order id, fulfillment…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Search sales report"
                />
              </div>

              <div className={styles.dateGroup}>
                <span className={styles.dateLabel}>Order Fulfillment Date</span>
                <div className={styles.dateRow}>
                  <input
                    type="date"
                    className={styles.dateInput}
                    value={fromDate}
                    max={toDate || undefined}
                    onChange={(e) => setFromDate(e.target.value)}
                    aria-label="Fulfilled from"
                  />
                  <span className={styles.dateTo}>to</span>
                  <input
                    type="date"
                    className={styles.dateInput}
                    value={toDate}
                    min={fromDate || undefined}
                    onChange={(e) => setToDate(e.target.value)}
                    aria-label="Fulfilled to"
                  />
                </div>
              </div>

              <button
                type="button"
                className={styles.exportBtn}
                onClick={() => downloadCsv(filtered)}
                disabled={loading || filtered.length === 0}
                title="Download the rows matching your filters"
              >
                <Download size={15} aria-hidden="true" />
                Export CSV
              </button>
            </div>

            <div className={styles.chips}>
              {DATE_PRESETS.map((p) => {
                const [from, to] = p.range();
                const active = fromDate === from && toDate === to;
                return (
                  <button
                    key={p.label}
                    type="button"
                    className={`${styles.chip} ${active ? styles.chipActive : ""}`}
                    aria-pressed={active}
                    onClick={() => {
                      setFromDate(from);
                      setToDate(to);
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
              {hasFilters && (
                <button type="button" className={styles.clearBtn} onClick={clearFilters}>
                  <X size={14} aria-hidden="true" />
                  Clear filters
                </button>
              )}
            </div>

            {loading ? (
              <p className={styles.state}>Loading…</p>
            ) : error ? (
              <p className={`${styles.state} ${styles.error}`}>{error}</p>
            ) : (
              <>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th className={styles.num}>No.</th>
                        {COLUMNS.map((c) => {
                          const active = sort.key === c.key;
                          return (
                            <th
                              key={c.key}
                              className={c.numeric ? styles.num : ""}
                              aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                            >
                              <button
                                type="button"
                                className={`${styles.sortBtn} ${active ? styles.sortActive : ""}`}
                                onClick={() => toggleSort(c.key)}
                              >
                                {c.label}
                                {active ? (
                                  sort.dir === "asc" ? (
                                    <ArrowUp size={13} aria-hidden="true" />
                                  ) : (
                                    <ArrowDown size={13} aria-hidden="true" />
                                  )
                                ) : (
                                  <ArrowUpDown size={13} className={styles.sortIdle} aria-hidden="true" />
                                )}
                              </button>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {paged.length === 0 ? (
                        <tr>
                          <td className={styles.empty} colSpan={COLUMNS.length + 1}>
                            <strong>No rows match your filters.</strong>
                            {hasFilters && (
                              <button type="button" className={styles.linkBtn} onClick={clearFilters}>
                                Clear filters
                              </button>
                            )}
                          </td>
                        </tr>
                      ) : (
                        paged.map((r, i) => (
                          <tr key={r.id}>
                            {/* Running number across pages, so page 2 starts at 11. */}
                            <td className={`${styles.num} ${styles.muted}`}>{firstIndex + i + 1}</td>
                            <td className={styles.nowrap}>{formatDate(r.purchase_date)}</td>
                            <td>
                              <span className={styles.code}>{r.item_code}</span>
                            </td>
                            <td>{r.set_}</td>
                            <td className={styles.num}>{r.qty}</td>
                            <td className={styles.num}>{money(r.product_sale_price)}</td>
                            <td className={`${styles.num} ${styles.strong}`}>{money(r.unit_price)}</td>
                            <td className={styles.mono}>{r.order_id}</td>
                            <td>
                              <span className={styles.pill}>{r.fulfillment}</span>
                            </td>
                            <td className={styles.nowrap}>{formatDate(r.shipped_date)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className={styles.pagination}>
                  <label className={styles.pageSize}>
                    <span>Show</span>
                    <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
                      {PAGE_SIZE_OPTIONS.map((n) => (
                        <option key={n} value={n}>
                          {n === 0 ? "All" : n}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className={styles.pageNav}>
                    <button
                      type="button"
                      className={styles.pageBtn}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                      aria-label="Previous page"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className={styles.pageText}>
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      type="button"
                      className={styles.pageBtn}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                      aria-label="Next page"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                  <span className={styles.showing}>
                    {filtered.length === 0
                      ? "Showing 0 of 0"
                      : `Showing ${firstIndex + 1}–${firstIndex + paged.length} of ${filtered.length}`}
                  </span>
                </div>
              </>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
