import { useEffect, useMemo, useState, type FormEvent } from "react";
import axios from "axios";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Download, Pencil, Search, Trash2, X } from "lucide-react";
import AppSidebar from "../components/AppSidebar";
import AppTopbar from "../components/AppTopbar";
import api from "../api/client";
import { matches } from "../utils/search";
import type { SaleReportRow } from "../types";
import styles from "./SaleReport.module.css";

// Rows-per-page choices; 0 means "All". Always starts at 10.
const PAGE_SIZE_OPTIONS = [10, 50, 100, 0];

type SortKey = "category" | "itemCode" | "set" | "qty" | "productSalesPrice" | "unitPrice" | "orderId" | "fulfillment" | "shippedDate";
type SortDir = "asc" | "desc";

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: "category", label: "Category" },
  { key: "itemCode", label: "Item code" },
  { key: "set", label: "Set", numeric: true },
  { key: "qty", label: "QTY", numeric: true },
  { key: "productSalesPrice", label: "Product sales price", numeric: true },
  { key: "unitPrice", label: "Unit price (Qty × Sales)", numeric: true },
  { key: "orderId", label: "Order id" },
  { key: "fulfillment", label: "Fulfillment" },
  { key: "shippedDate", label: "Shipped date" },
];

function money(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

// Stat-tile values: full precision while small, compacted once they get long.
function compactMoney(n: number): string {
  return Math.abs(n) >= 100_000
    ? n.toLocaleString(undefined, { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 })
    : money(n);
}

function compactCount(n: number): string {
  return n >= 10_000 ? n.toLocaleString(undefined, { notation: "compact", maximumFractionDigits: 1 }) : n.toLocaleString();
}

function errorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    return (err.response?.data as { error?: string } | undefined)?.error || fallback;
  }
  return fallback;
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// yyyy-mm-dd in local time (what <input type="date"> and shippedDate use).
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

function downloadCsv(rows: SaleReportRow[]) {
  const header = COLUMNS.map((c) => c.label);
  const lines = rows.map((r) => COLUMNS.map((c) => csvCell(r[c.key])).join(","));
  const blob = new Blob([[header.map(csvCell).join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sales-report-${isoDay(new Date())}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Edit form values — kept as strings so inputs can be blank mid-edit.
type EditForm = Record<
  "category" | "itemCode" | "set" | "qty" | "productSalesPrice" | "orderId" | "fulfillment" | "shippedDate",
  string
>;

function toForm(r: SaleReportRow): EditForm {
  return {
    category: r.category,
    itemCode: r.itemCode,
    set: String(r.set),
    qty: String(r.qty),
    productSalesPrice: String(r.productSalesPrice),
    orderId: r.orderId,
    fulfillment: r.fulfillment,
    shippedDate: r.shippedDate,
  };
}

// Distinct values already in use, plus the row's own value, so the edit
// dropdowns never drop what's there and typos can't split the data.
function optionsFor(rows: SaleReportRow[], key: "category" | "fulfillment", current: string): string[] {
  return Array.from(new Set([...rows.map((r) => r[key]), current].filter(Boolean))).sort();
}

export default function SaleReport() {
  const [rows, setRows] = useState<SaleReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "shippedDate", dir: "desc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [editing, setEditing] = useState<SaleReportRow | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<SaleReportRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<{ rows: SaleReportRow[] }>("/dashboard/sale-report");
        if (!cancelled) setRows(data.rows);
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

  const filtered = useMemo(() => {
    const out = rows
      .filter((r) => !fromDate || r.shippedDate >= fromDate)
      .filter((r) => !toDate || r.shippedDate <= toDate)
      .filter((r) => matches(`${r.category} ${r.itemCode} ${r.orderId} ${r.fulfillment}`, query));
    const dir = sort.dir === "asc" ? 1 : -1;
    return out.sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return cmp * dir;
    });
  }, [rows, fromDate, toDate, query, sort]);

  // Totals for whatever the filters currently match (not just this page).
  const totals = useMemo(() => {
    const sales = filtered.reduce((sum, r) => sum + r.unitPrice, 0);
    const orders = new Set(filtered.map((r) => r.orderId)).size;
    return {
      orders,
      units: filtered.reduce((sum, r) => sum + r.qty, 0),
      sales,
      avgOrder: orders ? sales / orders : 0,
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
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "shippedDate" ? "desc" : "asc" },
    );
  }

  function clearFilters() {
    setQuery("");
    setFromDate("");
    setToDate("");
  }

  function openEdit(r: SaleReportRow) {
    setEditing(r);
    setForm(toForm(r));
    setFormError("");
  }

  function closeEdit() {
    if (saving) return;
    setEditing(null);
    setForm(null);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!editing || !form) return;
    setSaving(true);
    setFormError("");
    try {
      const { data } = await api.patch<{ row: SaleReportRow }>(`/dashboard/sale-report/${editing.id}`, {
        ...form,
        set: Number(form.set),
        qty: Number(form.qty),
        productSalesPrice: Number(form.productSalesPrice),
      });
      setRows((prev) => prev.map((r) => (r.id === data.row.id ? data.row : r)));
      setEditing(null);
      setForm(null);
    } catch (err) {
      setFormError(errorMessage(err, "Couldn't save changes. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setActionError("");
    setDeleting(true);
    try {
      await api.delete(`/dashboard/sale-report/${confirmDelete.id}`);
      setRows((prev) => prev.filter((x) => x.id !== confirmDelete.id));
      setConfirmDelete(null);
    } catch (err) {
      setActionError(errorMessage(err, "Couldn't delete row. Please try again."));
      setConfirmDelete(null);
    } finally {
      setDeleting(false);
    }
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

          <section className={styles.card}>
            <div className={styles.toolbar}>
              <div className={styles.search}>
                <Search className={styles.searchIcon} size={16} aria-hidden="true" />
                <input
                  type="search"
                  placeholder="Search category, item code, order id…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Search sales report"
                />
              </div>

              <div className={styles.dateGroup}>
                <span className={styles.dateLabel}>Shipped date</span>
                <div className={styles.dateRow}>
                  <input
                    type="date"
                    className={styles.dateInput}
                    value={fromDate}
                    max={toDate || undefined}
                    onChange={(e) => setFromDate(e.target.value)}
                    aria-label="Shipped from"
                  />
                  <span className={styles.dateTo}>to</span>
                  <input
                    type="date"
                    className={styles.dateInput}
                    value={toDate}
                    min={fromDate || undefined}
                    onChange={(e) => setToDate(e.target.value)}
                    aria-label="Shipped to"
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

            {actionError && (
              <div className={styles.banner} role="alert">
                <span>{actionError}</span>
                <button type="button" onClick={() => setActionError("")} aria-label="Dismiss">
                  <X size={14} />
                </button>
              </div>
            )}

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
                        <th className={styles.actionsCol}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paged.length === 0 ? (
                        <tr>
                          <td className={styles.empty} colSpan={COLUMNS.length + 2}>
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
                            <td>{r.category}</td>
                            <td>
                              <span className={styles.code}>{r.itemCode}</span>
                            </td>
                            <td className={styles.num}>{r.set || "—"}</td>
                            <td className={styles.num}>{r.qty}</td>
                            <td className={styles.num}>{money(r.productSalesPrice)}</td>
                            <td className={`${styles.num} ${styles.strong}`}>{money(r.unitPrice)}</td>
                            <td className={styles.mono}>{r.orderId}</td>
                            <td>
                              <span className={styles.pill}>{r.fulfillment}</span>
                            </td>
                            <td className={styles.nowrap}>{formatDate(r.shippedDate)}</td>
                            <td className={styles.actionsCol}>
                              <div className={styles.rowActions}>
                                <button
                                  type="button"
                                  className={styles.iconBtn}
                                  onClick={() => openEdit(r)}
                                  aria-label={`Edit order ${r.orderId}`}
                                  title="Edit"
                                >
                                  <Pencil size={15} />
                                </button>
                                <button
                                  type="button"
                                  className={`${styles.iconBtn} ${styles.iconDanger}`}
                                  onClick={() => setConfirmDelete(r)}
                                  aria-label={`Delete order ${r.orderId}`}
                                  title="Delete"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
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

          {editing && form && (
            <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="edit-row-title" onClick={closeEdit}>
              <form className={styles.modal} onClick={(e) => e.stopPropagation()} onSubmit={handleSave}>
                <h3 id="edit-row-title" className={styles.modalTitle}>
                  Edit order <span className={styles.mono}>{editing.orderId}</span>
                </h3>
                <div className={styles.formGrid}>
                  {(["category", "fulfillment"] as const).map((key) => (
                    <label key={key} className={styles.formField}>
                      <span>{key === "category" ? "Category" : "Fulfillment"}</span>
                      <select required value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}>
                        {optionsFor(rows, key, editing[key]).map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                  {(
                    [
                      ["itemCode", "Item code", "text"],
                      ["orderId", "Order id", "text"],
                      ["set", "Set", "number"],
                      ["qty", "QTY", "number"],
                      ["productSalesPrice", "Product sales price", "number"],
                      ["shippedDate", "Shipped date", "date"],
                    ] as const
                  ).map(([key, label, type]) => (
                    <label key={key} className={styles.formField}>
                      <span>{label}</span>
                      <input
                        type={type}
                        value={form[key]}
                        required
                        min={type === "number" ? (key === "qty" ? 1 : 0) : undefined}
                        step={key === "productSalesPrice" ? "0.01" : type === "number" ? "1" : undefined}
                        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                      />
                    </label>
                  ))}
                </div>
                <div className={styles.formHint}>
                  <span>Unit price (QTY × sales price)</span>
                  <strong>
                    {form.qty !== "" && form.productSalesPrice !== ""
                      ? money(Number(form.qty) * Number(form.productSalesPrice))
                      : "—"}
                  </strong>
                </div>
                {formError && <p className={`${styles.state} ${styles.error}`}>{formError}</p>}
                <div className={styles.modalActions}>
                  <button type="button" className={styles.cancel} onClick={closeEdit} disabled={saving}>
                    Cancel
                  </button>
                  <button type="submit" className={styles.save} disabled={saving}>
                    {saving ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {confirmDelete && (
            <div
              className={styles.modalOverlay}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="delete-row-title"
              onClick={() => !deleting && setConfirmDelete(null)}
            >
              <div className={`${styles.modal} ${styles.modalSmall}`} onClick={(e) => e.stopPropagation()}>
                <h3 id="delete-row-title" className={styles.modalTitle}>
                  Delete this row?
                </h3>
                <p className={styles.modalBody}>
                  Order <span className={styles.mono}>{confirmDelete.orderId}</span> · {confirmDelete.itemCode} ·{" "}
                  {formatDate(confirmDelete.shippedDate)}. This can't be undone.
                </p>
                <div className={styles.modalActions}>
                  <button type="button" className={styles.cancel} onClick={() => setConfirmDelete(null)} disabled={deleting}>
                    Cancel
                  </button>
                  <button type="button" className={styles.danger} onClick={handleDelete} disabled={deleting}>
                    {deleting ? "Deleting…" : "Delete"}
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
