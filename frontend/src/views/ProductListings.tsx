import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, ImageIcon, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import AppSidebar from "../components/AppSidebar";
import AppTopbar from "../components/AppTopbar";
import api from "../api/client";
import { matches } from "../utils/search";
import { errorMessage } from "./productForm";
import styles from "./ProductListings.module.css";

// Rows-per-page choices; 0 means "All". Always starts at 10 (same as Sales report).
const PAGE_SIZE_OPTIONS = [10, 50, 100, 0];

interface ListingRow {
  id: string;
  division: string;
  dtiItemCode: string;
  dtiItemDescription: string;
  type: string;
  ean: string;
  imageUrl: string | null;
  images?: { url: string; path: string }[];
  source: "added" | "amazon";
  sku?: string;
}

interface AmazonListingRow {
  source: "amazon" | "item";
  sku: string | null;
  image_url: string | null;
  division: string | null;
  dti_item_code: string | null;
  dti_item_description: string | null;
  type: string | null;
  ean: string | null;
}

type SourceFilter = "all" | "added" | "amazon";

// Everything comes from Postgres via GET /api/dashboard/listing-data: your items
// with no Amazon listing yet ("Added here" — created with "Add new product"),
// then Amazon's listings. Edits save to core.items / core.item_sku_map.
export default function ProductListings() {
  const [products, setProducts] = useState<ListingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [pageSize, setPageSize] = useState(10);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  // Set when we arrive straight from "Add row" / "Save changes" on the form page.
  const flash = useLocation().state as { added?: string; updated?: string } | null;
  // The row being deleted plus its No. in the table at that moment (for the audit log).
  const [confirmDelete, setConfirmDelete] = useState<(ListingRow & { no: number }) | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState("");
  const [deletedCode, setDeletedCode] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    setActionError("");
    try {
      if (confirmDelete.source === "amazon") {
        // Amazon data is read-only here — this only hides the row from the page.
        await api.post("/dashboard/listing-data/hide", {
          sku: confirmDelete.sku,
          rowNo: confirmDelete.no,
          dtiItemCode: confirmDelete.dtiItemCode,
        });
      } else {
        await api.delete(`/dashboard/listing-items/${encodeURIComponent(confirmDelete.dtiItemCode)}`, {
          params: { no: confirmDelete.no },
        });
      }
      setProducts((prev) => prev.filter((r) => r.id !== confirmDelete.id));
      setDeletedCode(confirmDelete.dtiItemCode);
    } catch (err) {
      setActionError(errorMessage(err, "Couldn't delete this listing. Please try again."));
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ rows: AmazonListingRow[] }>("/dashboard/listing-data", { timeout: 30000 })
      .then(({ data }) => {
        if (cancelled) return;
        setProducts(
          data.rows.map((r, i) => ({
            id: r.source === "item" ? `item-${r.dti_item_code}` : `amazon-${r.sku || i}`,
            source: r.source === "item" ? ("added" as const) : ("amazon" as const),
            sku: r.sku ?? undefined,
            division: r.division ?? "",
            dtiItemCode: r.dti_item_code ?? "",
            dtiItemDescription: r.dti_item_description ?? "",
            type: r.type ?? "",
            ean: r.ean ?? "",
            imageUrl: r.image_url || null,
            images: r.image_url ? [{ url: r.image_url, path: "" }] : [],
          })),
        );
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setLoadError("Couldn't load the listing from the database.");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(
    () =>
      products
        .filter((p) => sourceFilter === "all" || p.source === sourceFilter)
        .filter((p) => matches(`${p.division} ${p.dtiItemCode} ${p.dtiItemDescription} ${p.type} ${p.ean}`, query)),
    [products, query, sourceFilter],
  );

  // A new search or page size changes which rows land on which page.
  useEffect(() => {
    setPage(1);
  }, [query, pageSize, sourceFilter]);

  const perPage = pageSize || filtered.length || 1;
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const firstIndex = (currentPage - 1) * perPage;
  const paged = filtered.slice(firstIndex, firstIndex + perPage);

  return (
    <div className="app-shell">
      <AppSidebar />
      <div className="app-content">
        <AppTopbar title="Product Listing" />
        <main className={styles.content}>
          <section className={styles.card}>
            <div className={styles.header}>
              <h3 className={styles.title}>Product Listings</h3>
              <Link to="/product-listings/new" className={styles.addBtn}>
                <Plus size={16} aria-hidden="true" />
                Add new product
              </Link>
            </div>

            {deletedCode ? (
              <p className={styles.success} role="status">
                Deleted {deletedCode} from the listing.
              </p>
            ) : flash?.added ? (
              <p className={styles.success} role="status">
                Added {flash.added} to the listing.
              </p>
            ) : flash?.updated ? (
              <p className={styles.success} role="status">
                Saved changes to {flash.updated}.
              </p>
            ) : null}
            {actionError && <p className={styles.errorBanner}>{actionError}</p>}

            <div className={styles.toolbar}>
              <div className={styles.search}>
                <Search className={styles.searchIcon} size={16} aria-hidden="true" />
                <input
                  type="search"
                  placeholder="Search division, DTI item Code, description, type, EAN…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Search Product Listing"
                />
              </div>
              {query && (
                <button type="button" className={styles.clearBtn} onClick={() => setQuery("")}>
                  <X size={14} aria-hidden="true" />
                  Clear
                </button>
              )}
              <div className={styles.sourceTabs} role="tablist" aria-label="Filter by source">
                {(
                  [
                    ["all", "All"],
                    ["added", "Added here"],
                    ["amazon", "From Amazon"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={sourceFilter === key}
                    className={`${styles.sourceTab} ${sourceFilter === key ? styles.sourceTabActive : ""}`}
                    onClick={() => setSourceFilter(key)}
                  >
                    {label}
                    <span className={styles.sourceCount}>
                      {key === "all" ? products.length : products.filter((p) => p.source === key).length}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.noCol}>No.</th>
                    <th className={styles.imageCol}>Image</th>
                    <th>Division</th>
                    <th>DTI item Code</th>
                    <th>DTI Item Description</th>
                    <th>Type</th>
                    <th>EAN</th>
                    <th className={styles.actionsCol}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading || loadError || paged.length === 0 ? (
                    <tr>
                      <td colSpan={8} className={`${styles.state} ${loadError ? styles.error : ""}`}>
                        {loading
                          ? "Loading…"
                          : loadError ||
                            (products.length === 0
                              ? "No listings yet — use “Add new product” to add one."
                              : "No listings match your search.")}
                      </td>
                    </tr>
                  ) : (
                    paged.map((p, i) => (
                      <tr key={p.id}>
                        {/* Running number across pages, so page 2 starts at 11. */}
                        <td className={styles.noCol}>{firstIndex + i + 1}</td>
                        <td className={styles.imageCol}>
                          {p.imageUrl ? (
                            <div className={styles.imageStack}>
                              <img src={p.imageUrl} alt={p.dtiItemDescription} className={styles.imageTile} />
                              {(p.images?.length ?? 0) > 1 && (
                                <span className={styles.photoCount} title={`${p.images!.length} photos`}>
                                  +{p.images!.length - 1}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className={styles.imageTile} role="img" aria-label={`No image yet for ${p.dtiItemCode}`}>
                              <ImageIcon size={28} aria-hidden="true" />
                            </div>
                          )}
                        </td>
                        <td>{p.division || "—"}</td>
                        <td>{p.dtiItemCode || "—"}</td>
                        <td>{p.dtiItemDescription || "—"}</td>
                        <td>{p.type || "—"}</td>
                        <td>{p.ean || "—"}</td>
                        <td className={styles.actionsCol}>
                          <div className={styles.rowActions}>
                            <button
                              type="button"
                              className={styles.iconBtn}
                              onClick={() =>
                                p.source === "amazon"
                                  ? // Amazon rows are edited in place and saved to Postgres.
                                    navigate(`/product-listings/amazon/${encodeURIComponent(p.sku ?? "")}/edit`, {
                                      state: { no: firstIndex + i + 1 },
                                    })
                                  : navigate(`/product-listings/${encodeURIComponent(p.dtiItemCode)}/edit`, {
                                      state: { no: firstIndex + i + 1 },
                                    })
                              }
                              title={p.source === "amazon" ? "Edit (saves to the database)" : "Edit"}
                              aria-label={`Edit ${p.dtiItemCode}`}
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              type="button"
                              className={`${styles.iconBtn} ${styles.iconDanger}`}
                              onClick={() => setConfirmDelete({ ...p, no: firstIndex + i + 1 })}
                              aria-label={`Delete ${p.dtiItemCode}`}
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
                  onClick={() => setPage((n) => Math.max(1, n - 1))}
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
                  onClick={() => setPage((n) => Math.min(totalPages, n + 1))}
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

          {confirmDelete && (
            <div
              className={styles.modalOverlay}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="delete-listing-title"
              onClick={() => !deleting && setConfirmDelete(null)}
            >
              <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <h3 id="delete-listing-title" className={styles.modalTitle}>
                  {confirmDelete.source === "amazon" ? "Remove this Amazon listing?" : "Delete this listing?"}
                </h3>
                {confirmDelete.source === "amazon" ? (
                  <p className={styles.modalBody}>
                    {confirmDelete.dtiItemCode || confirmDelete.sku} · {confirmDelete.dtiItemDescription} will be hidden from
                    Product Listing for everyone. Amazon's data in the database isn't changed.
                  </p>
                ) : (
                <p className={styles.modalBody}>
                  {confirmDelete.dtiItemCode} · {confirmDelete.dtiItemDescription}
                  {(confirmDelete.images?.length ?? 0) > 0
                    ? ` and its ${confirmDelete.images!.length === 1 ? "photo" : `${confirmDelete.images!.length} photos`}`
                    : ""}{" "}
                  will be removed. This can't be undone.
                </p>
                )}
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
