import { useEffect, useState, type FormEvent } from "react";
import axios from "axios";
import AppSidebar from "../components/AppSidebar";
import AppTopbar from "../components/AppTopbar";
import api from "../api/client";
import { matches } from "../utils/search";
import type { SaleReportRow } from "../types";
import styles from "./SaleReport.module.css";

const PAGE_SIZE = 10;

function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

function errorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    return (err.response?.data as { error?: string } | undefined)?.error || fallback;
  }
  return fallback;
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function SaleReport() {
  const [rows, setRows] = useState<SaleReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);

  const [editing, setEditing] = useState<SaleReportRow | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

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

  async function handleDelete(r: SaleReportRow) {
    if (!window.confirm(`Delete order ${r.orderId} (${r.itemCode})? This cannot be undone.`)) return;
    setActionError("");
    setDeletingId(r.id);
    try {
      await api.delete(`/dashboard/sale-report/${r.id}`);
      setRows((prev) => prev.filter((x) => x.id !== r.id));
    } catch (err) {
      setActionError(errorMessage(err, "Couldn't delete row. Please try again."));
    } finally {
      setDeletingId(null);
    }
  }

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

  const filtered = rows
    .filter((r) => !fromDate || r.shippedDate >= fromDate)
    .filter((r) => !toDate || r.shippedDate <= toDate)
    .filter((r) => matches(`${r.category} ${r.itemCode} ${r.orderId} ${r.fulfillment}`, query));

  // A new search term or date range changes which rows match, so whatever
  // page we were on no longer means the same thing — back to 1.
  useEffect(() => {
    setPage(1);
  }, [query, fromDate, toDate]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="app-shell">
      <AppSidebar />
      <div className="app-content">
        <AppTopbar title="Sales Reports" />
        <main className={styles.content}>
          <section className={styles.card}>
            <div className={styles.toolbar}>
              <div className={styles.search}>
                <svg
                  className={styles.searchIcon}
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="7" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="search"
                  placeholder="Search by category, item code, order id, fulfillment…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Search sales report"
                />
              </div>

              <div className={styles.dateFilter}>
                <span className={styles.dateFilterLabel}>Date Filter</span>
                <div className={styles.dateFilterRow}>
                  <label className={styles.dateField}>
                    <span>From</span>
                    <input
                      type="date"
                      value={fromDate}
                      max={toDate || undefined}
                      onChange={(e) => setFromDate(e.target.value)}
                    />
                  </label>
                  <span className={styles.dateDash} aria-hidden="true" />
                  <label className={styles.dateField}>
                    <span>To</span>
                    <input
                      type="date"
                      value={toDate}
                      min={fromDate || undefined}
                      onChange={(e) => setToDate(e.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    className={styles.resetBtn}
                    onClick={() => {
                      setFromDate("");
                      setToDate("");
                    }}
                    disabled={!fromDate && !toDate}
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>

            {actionError && <p className={`${styles.state} ${styles.error}`}>{actionError}</p>}
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
                        <th>Category</th>
                        <th>Item Code</th>
                        <th>Set</th>
                        <th>QTY</th>
                        <th>Product Sales Price</th>
                        <th>Unit price (Sales/Qty)</th>
                        <th>Order id</th>
                        <th>Fulfillment</th>
                        <th>Shipped Date</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paged.length === 0 ? (
                        <tr>
                          <td className={styles.empty} colSpan={10}>
                            No rows match the current filters.
                          </td>
                        </tr>
                      ) : (
                        paged.map((r) => (
                          <tr key={r.id}>
                            <td>{r.category}</td>
                            <td>{r.itemCode}</td>
                            <td>{r.set || "—"}</td>
                            <td>{r.qty}</td>
                            <td>{money(r.productSalesPrice)}</td>
                            <td>{money(r.unitPrice)}</td>
                            <td>{r.orderId}</td>
                            <td>{r.fulfillment}</td>
                            <td>{formatDate(r.shippedDate)}</td>
                            <td>
                              <div className={styles.rowActions}>
                                <button type="button" className={styles.editBtn} onClick={() => openEdit(r)}>
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className={styles.deleteBtn}
                                  onClick={() => handleDelete(r)}
                                  disabled={deletingId === r.id}
                                >
                                  {deletingId === r.id ? "Deleting…" : "Delete"}
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
                  <button
                    type="button"
                    className={styles.pageBtn}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    aria-label="Previous page"
                  >
                    ←
                  </button>
                  <span className={styles.pageText}>
                    {currentPage} of {totalPages} pages
                  </span>
                  <button
                    type="button"
                    className={styles.pageBtn}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    aria-label="Next page"
                  >
                    →
                  </button>
                </div>
              </>
            )}
          </section>

          {editing && form && (
            <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="edit-row-title" onClick={closeEdit}>
              <form className={styles.modal} onClick={(e) => e.stopPropagation()} onSubmit={handleSave}>
                <h3 id="edit-row-title" className={styles.modalTitle}>
                  Edit {editing.orderId}
                </h3>
                <div className={styles.formGrid}>
                  {(
                    [
                      ["category", "Category", "text"],
                      ["itemCode", "Item Code", "text"],
                      ["set", "Set", "number"],
                      ["qty", "QTY", "number"],
                      ["productSalesPrice", "Product Sales Price", "number"],
                      ["orderId", "Order id", "text"],
                      ["fulfillment", "Fulfillment", "text"],
                      ["shippedDate", "Shipped Date", "date"],
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
                <p className={styles.formHint}>
                  Unit price is recalculated as sales price ÷ QTY
                  {Number(form.qty) > 0 && form.productSalesPrice !== ""
                    ? ` (${money(Number(form.productSalesPrice) / Number(form.qty))})`
                    : ""}
                  .
                </p>
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
        </main>
      </div>
    </div>
  );
}
