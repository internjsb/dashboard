import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Pencil, Trash2 } from "lucide-react";
import api from "../api/client";
import AppSidebar from "../components/AppSidebar";
import AppTopbar from "../components/AppTopbar";
import DataTable, { type DataTableColumn, type DataTableFilter } from "../components/DataTable";
import { ProductForm, errorMessage, useProducts, type ProductPayload, type ProductRow } from "./productForm";
import styles from "./Products.module.css";

export default function Products() {
  const { products, loading, loadError } = useProducts();
  const [editing, setEditing] = useState<ProductRow | null>(null);
  // Set when we arrive straight from a successful save on the Add product page.
  const added = (useLocation().state as { added?: string } | null)?.added;
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function startEdit(product: ProductRow) {
    setEditing(product);
  }

  async function saveEdit(payload: ProductPayload) {
    if (!editing) return;
    // Writes go through the backend — RTDB rules block client writes to products/.
    await api.patch(`/dashboard/products/${editing.id}`, payload);
    setEditing(null);
  }

  async function handleDelete(product: ProductRow) {
    if (!window.confirm(`Delete ${product.sku || "this product"}? This cannot be undone.`)) return;
    setDeleteError(null);
    setDeletingId(product.id);
    try {
      await api.delete(`/dashboard/products/${product.id}`);
      if (editing?.id === product.id) setEditing(null);
    } catch (err) {
      setDeleteError(errorMessage(err, "Couldn't delete product. Please try again."));
    } finally {
      setDeletingId(null);
    }
  }

  const columns: DataTableColumn<ProductRow>[] = [
    { key: "sn", header: "S/N", accessor: (p) => p.sn },
    { key: "sku", header: "SKU", accessor: (p) => p.sku },
    { key: "division", header: "Division", accessor: (p) => p.division },
    { key: "dtiItemCode", header: "DTI Item Code", accessor: (p) => p.dtiItemCode },
    { key: "set", header: "Set", accessor: (p) => p.set },
    { key: "dtiItemDescription", header: "DTI Item Description", accessor: (p) => p.dtiItemDescription },
    { key: "type", header: "Type", accessor: (p) => p.type },
    { key: "country", header: "Country", accessor: (p) => p.country },
    { key: "asin", header: "ASIN", accessor: (p) => p.asin },
    { key: "fnsku", header: "FNSKU", accessor: (p) => p.fnsku },
    { key: "ean", header: "EAN", accessor: (p) => p.ean },
    { key: "description", header: "Description", accessor: (p) => p.description },
    { key: "status", header: "Status", accessor: (p) => p.status },
    {
      key: "actions",
      header: "Actions",
      sortable: false,
      searchable: false,
      sticky: "right",
      render: (p) => (
        <div className={styles.rowActions}>
          <button
            type="button"
            className={styles.editBtn}
            onClick={() => startEdit(p)}
            aria-label={`Edit ${p.sku}`}
            title="Edit"
          >
            <Pencil size={15} />
          </button>
          <button
            type="button"
            className={styles.deleteBtn}
            disabled={deletingId === p.id}
            onClick={() => handleDelete(p)}
            aria-label={`Delete ${p.sku}`}
            title={deletingId === p.id ? "Deleting…" : "Delete"}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];

  const productFilters: DataTableFilter<ProductRow>[] = [
    {
      key: "dtiItemCode",
      label: "DTI Item Code",
      accessor: (p) => p.dtiItemCode,
      options: Array.from(new Set(products.map((p) => p.dtiItemCode)))
        .sort()
        .map((code) => ({ value: code, label: code })),
    },
  ];

  return (
    <div className="app-shell">
      <AppSidebar />
      <div className="app-content">
        <AppTopbar title="Products" />
        <main className={styles.content}>
          <p className={styles.intro}>Product catalog.</p>

          <Link to="/products/new" className={`${styles.saveBtn} ${styles.addBtn}`}>
            Add product
          </Link>

          {editing && (
            <div
              className={styles.modalOverlay}
              role="dialog"
              aria-modal="true"
              aria-labelledby="product-form-title"
              onClick={() => setEditing(null)}
            >
              <section className={`${styles.card} ${styles.modal}`} onClick={(e) => e.stopPropagation()}>
                <h3 id="product-form-title" className={styles.modalTitle}>
                  Edit product
                </h3>
                <ProductForm
                  key={editing.id}
                  products={products}
                  editing={editing}
                  submitLabel="Save changes"
                  onSubmit={saveEdit}
                  onCancel={() => setEditing(null)}
                />
              </section>
            </div>
          )}

          <section className={styles.card}>
            <div className={styles.cardHead}>
              <h3>Products</h3>
              <span className={styles.cardSub}>Product master list</span>
            </div>
            {added && (
              <p className={styles.success} role="status">
                Added {added} to the product list.
              </p>
            )}
            {deleteError && <p className={styles.error}>{deleteError}</p>}
            {loadError ? (
              <p className={styles.error}>{loadError}</p>
            ) : (
              <DataTable
                columns={columns}
                rows={products}
                rowKey={(p) => p.id}
                filters={productFilters}
                searchPlaceholder="Search products…"
                emptyMessage={loading ? "Loading…" : "No products yet."}
              />
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
