import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, ImageIcon, Pencil, Plus, Trash2 } from "lucide-react";
import AppSidebar from "../components/AppSidebar";
import AppTopbar from "../components/AppTopbar";
import api from "../api/client";
import { errorMessage } from "./productForm";
import styles from "./ProductListings.module.css";

const PAGE_SIZE = 10;

interface ListingRow {
  id: string;
  division: string;
  dtiItemCode: string;
  dtiItemDescription: string;
  type: string;
  ean: string;
  imageUrl: string | null;
}

// Rows added from "Add new product" (/product-listings/new). Images live in
// Firebase Storage; rows added without one show a placeholder tile.
export default function ProductListings() {
  const [products, setProducts] = useState<ListingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const navigate = useNavigate();
  // Set when we arrive straight from "Add row" / "Save changes" on the form page.
  const flash = useLocation().state as { added?: string; updated?: string } | null;
  const [confirmDelete, setConfirmDelete] = useState<ListingRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState("");
  const [deletedCode, setDeletedCode] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    setActionError("");
    try {
      await api.delete(`/dashboard/listings/${confirmDelete.id}`);
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
      .get<{ rows: ListingRow[] }>("/dashboard/listings")
      .then(({ data }) => !cancelled && setProducts(data.rows))
      .catch((err) => {
        console.error(err);
        if (!cancelled) setLoadError("Couldn't load the listing.");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const totalPages = Math.max(1, Math.ceil(products.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = products.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="app-shell">
      <AppSidebar />
      <div className="app-content">
        <AppTopbar title="AMAZON Listing" />
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

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.noCol}>No.</th>
                    <th className={styles.imageCol}>Image</th>
                    <th>Division</th>
                    <th>DTI item</th>
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
                        {loading ? "Loading…" : loadError || "No listings yet — use “Add new product” to add one."}
                      </td>
                    </tr>
                  ) : (
                    paged.map((p, i) => (
                      <tr key={p.id}>
                        {/* Running number across pages, so page 2 starts at 11. */}
                        <td className={styles.noCol}>{(currentPage - 1) * PAGE_SIZE + i + 1}</td>
                        <td className={styles.imageCol}>
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt={p.dtiItemDescription} className={styles.imageTile} />
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
                              onClick={() => navigate(`/product-listings/${p.id}/edit`)}
                              aria-label={`Edit ${p.dtiItemCode}`}
                              title="Edit"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              type="button"
                              className={`${styles.iconBtn} ${styles.iconDanger}`}
                              onClick={() => setConfirmDelete(p)}
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
          </section>

          <div className={styles.pagination}>
            <button
              type="button"
              className={styles.arrow}
              onClick={() => setPage((n) => Math.max(1, n - 1))}
              disabled={currentPage <= 1}
              aria-label="Previous page"
            >
              <ArrowLeft size={22} />
            </button>
            <span className={styles.pageText}>
              {currentPage} of {totalPages} {totalPages === 1 ? "page" : "pages"}
            </span>
            <button
              type="button"
              className={styles.arrow}
              onClick={() => setPage((n) => Math.min(totalPages, n + 1))}
              disabled={currentPage >= totalPages}
              aria-label="Next page"
            >
              <ArrowRight size={22} />
            </button>
          </div>

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
                  Delete this listing?
                </h3>
                <p className={styles.modalBody}>
                  {confirmDelete.dtiItemCode} · {confirmDelete.dtiItemDescription}
                  {confirmDelete.imageUrl ? " and its image" : ""} will be removed. This can't be undone.
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
