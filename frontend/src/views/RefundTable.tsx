import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Download, Search, X } from "lucide-react";
import AppSidebar from "../components/AppSidebar";
import AppTopbar from "../components/AppTopbar";
import { matches } from "../utils/search";
import api from "../api/client";
// Same look as the Sales report.
import styles from "./SaleReport.module.css";

// Rows-per-page choices; 0 means "All". Always starts at 10.
const PAGE_SIZE_OPTIONS = [10, 50, 100, 0];

// One refund / return line. No data source yet — the table is empty until a
// query is hooked up (dates as DD/MM/YY, like the Sales report).
interface RefundRow {
  id: string;
  category: string;
  return_date: string;
  item_code: string;
  set_: string;
  qty: number;
  product_refund_price: number;
  unit_price: number;
  order_id: string;
  detailed_disposition: string;
  reason: string;
  status: string;
  fulfillment: string;
  purchase_date: string;
}

type SortKey = Exclude<keyof RefundRow, "id">;
type SortDir = "asc" | "desc";





const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: "category", label: "Category" },
  { key: "return_date", label: "Return Date" },
  { key: "item_code", label: "Product Item Code" },
  { key: "set_", label: "Set Per Package" },
  { key: "qty", label: "QTY", numeric: true },
  { key: "product_refund_price", label: "Product Refund Price", numeric: true },
  { key: "unit_price", label: "Unit price (Sales/Qty)", numeric: true },
  { key: "order_id", label: "Order id" },
  { key: "detailed_disposition", label: "Detailed Disposition" },
  { key: "reason", label: "Reason" },
  { key: "status", label: "Status" },
  { key: "fulfillment", label: "Fulfillment" },
  { key: "purchase_date", label: "Purchase Date" },
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

// DD/MM/YY ("24/09/26") -> YYYY-MM-DD ("2026-09-24") for comparing and sorting;
// anything else is returned unchanged.
function sortableDate(value: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{2})$/.exec(value.trim());
  return m ? `20${m[3]}-${m[2]}-${m[1]}` : value;
}

const DATE_KEYS: ReadonlySet<SortKey> = new Set(["return_date", "purchase_date"]);

// yyyy-mm-dd in local time (what <input type="date"> uses).
function isoDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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

function csvValue(r: RefundRow, key: SortKey): string | number {
  if (key === "product_refund_price" || key === "unit_price") return r[key].toFixed(2);
  return r[key];
}

function downloadCsv(rows: RefundRow[]) {
  const header = COLUMNS.map((c) => c.label);
  const lines = rows.map((r) => COLUMNS.map((c) => csvCell(csvValue(r, c.key))).join(","));
  const blob = new Blob([[header.map(csvCell).join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `refund-table-${isoDay(new Date())}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function RefundTable() {
  // No data source yet. When there is one, load it here the way the Sales
  // report does and pass the rows to setRows.
  const [rows, setRows] = useState<RefundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

useEffect(() => {
  let cancelled = false;
  api
    .get<{ rows: RefundRow[] }>("/health/refund_table", { timeout: 30000 })
    .then(({ data }) => {
      if (cancelled) return;
      setRows(
        data.rows.map((r, i) => ({
          ...r,
          id: `${r.order_id}-${i}`, // the query has no id column
          set_: r.set_ == null ? "" : String(r.set_),
          // numeric columns arrive as text — make them numbers so totals add up
          qty: Number(r.qty) || 0,
          product_refund_price: Number(r.product_refund_price) || 0,
          unit_price: Number(r.unit_price) || 0,
        })),
      );
    })
    .catch(() => !cancelled && setError("Couldn't load refunds."))
    .finally(() => !cancelled && setLoading(false));
  return () => {
    cancelled = true;
  };
}, []);

  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "return_date", dir: "desc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filtered = useMemo(() => {
    const out = rows
      // Date range is by return date; rows without one only show when no range is set.
      .filter((r) => !fromDate || (!!r.return_date && sortableDate(r.return_date) >= fromDate))
      .filter((r) => !toDate || (!!r.return_date && sortableDate(r.return_date) <= toDate))
      .filter((r) =>
        matches(
          `${r.category} ${r.item_code} ${r.set_} ${r.order_id} ${r.detailed_disposition} ${r.reason} ${r.status} ${r.fulfillment}`,
          query,
        ),
      );
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
    const refunded = filtered.reduce((sum, r) => sum + r.product_refund_price, 0);
    const orders = filtered.length;
    return {
      orders,
      units: filtered.reduce((sum, r) => sum + (Number(r.set_) || 0), 0),
      refunded,
      avgRefund: orders ? refunded / orders : 0,
    };
  }, [filtered]);

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
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: DATE_KEYS.has(key) ? "desc" : "asc" },
    );
  }

  function clearFilters() {
    setQuery("");
    setFromDate("");
    setToDate("");
  }

  const stats = [
    { label: "Total Refunded orders", value: compactCount(totals.orders) },
    { label: "Units returned", value: compactCount(totals.units) },
    { label: "Total refunds", value: compactMoney(totals.refunded) },
    { label: "Avg refund", value: compactMoney(totals.avgRefund) },
  ];

  return (
    <div className="app-shell">
      <AppSidebar />
      <div className="app-content">
        <AppTopbar title="Refund table" />
        <main className={styles.content}>
          <section className={styles.stats} aria-label="Totals for the current filters">
            {stats.map((s) => (
              <div key={s.label} className={styles.stat}>
                <span className={styles.statLabel}>{s.label}</span>
                <span className={styles.statValue}>{s.value}</span>
              </div>
            ))}
          </section>
          <p className={styles.statsNote}>
            {hasFilters ? "Totals for the rows matching your filters." : "Totals for all rows."}
          </p>

          <section className={styles.card}>
            <div className={styles.toolbar}>
              <div className={styles.search}>
                <Search className={styles.searchIcon} size={16} aria-hidden="true" />
                <input
                  type="search"
                  placeholder="Search item code, order id, reason, status…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Search refund table"
                />
              </div>

              <div className={styles.dateGroup}>
                <span className={styles.dateLabel}>Return Date</span>
                <div className={styles.dateRow}>
                  <input
                    type="date"
                    className={styles.dateInput}
                    value={fromDate}
                    max={toDate || undefined}
                    onChange={(e) => setFromDate(e.target.value)}
                    aria-label="Returned from"
                  />
                  <span className={styles.dateTo}>to</span>
                  <input
                    type="date"
                    className={styles.dateInput}
                    value={toDate}
                    min={fromDate || undefined}
                    onChange={(e) => setToDate(e.target.value)}
                    aria-label="Returned to"
                  />
                </div>
              </div>

              <button
                type="button"
                className={styles.exportBtn}
                onClick={() => downloadCsv(filtered)}
                disabled={filtered.length === 0}
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
                        <strong>{rows.length === 0 ? "No refunds yet." : "No rows match your filters."}</strong>
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
                        <td>{r.category}</td>
                        <td className={styles.nowrap}>{formatDate(r.return_date)}</td>
                        <td>
                          <span className={styles.code}>{r.item_code}</span>
                        </td>
                        <td>{r.set_}</td>
                        <td className={styles.num}>{r.qty}</td>
                        <td className={styles.num}>{money(r.product_refund_price)}</td>
                        <td className={`${styles.num} ${styles.strong}`}>{money(r.unit_price)}</td>
                        <td className={styles.mono}>{r.order_id}</td>
                        <td>{r.detailed_disposition}</td>
                        <td>{r.reason}</td>
                        <td>
                          <span className={styles.pill}>{r.status}</span>
                        </td>
                        <td>
                          <span className={styles.pill}>{r.fulfillment}</span>
                        </td>
                        <td className={styles.nowrap}>{formatDate(r.purchase_date)}</td>
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
          </section>
        </main>
      </div>
    </div>
  );
}
