import { useEffect, useMemo, useState, type FormEvent } from "react";
import { onValue, orderByChild, push, query, ref, serverTimestamp } from "firebase/database";
import AppSidebar from "../components/AppSidebar";
import AppTopbar from "../components/AppTopbar";
import DataTable, { type DataTableColumn } from "../components/DataTable";
import { rtdb } from "../firebase";
import styles from "./Products.module.css";

const PRODUCTS_PATH = "products";

interface ProductRow {
  id: string;
  sn: number;
  sku: string;
  division: string;
  dtiItemCode: string;
  set: number;
  dtiItemDescription: string;
  type: string;
  country: string;
  asin: string;
  fnsku: string;
  ean: string;
  description: string;
  status: string;
}

type FieldKey = Exclude<keyof ProductRow, "sn" | "set">;

const STATUS_OPTIONS = ["Active", "Inactive"];

const DEFAULT_SET = "1";

// Every field is required except "fnsku". "Set" is a number (qty per pack), required, defaults to 1.
const FIELDS: { key: FieldKey; label: string; required: boolean; options?: string[] }[] = [
  { key: "sku", label: "SKU", required: true },
  { key: "division", label: "Division", required: true },
  { key: "dtiItemCode", label: "DTI Item Code", required: true },
  { key: "dtiItemDescription", label: "DTI Item Description", required: true },
  { key: "type", label: "Type", required: true },
  { key: "country", label: "Country", required: true },
  { key: "asin", label: "ASIN", required: true },
  { key: "fnsku", label: "FNSKU", required: false },
  { key: "ean", label: "EAN", required: true },
  { key: "description", label: "Description", required: true },
  { key: "status", label: "Status", required: true, options: STATUS_OPTIONS },
];

const EMPTY_FORM: Record<FieldKey, string> = FIELDS.reduce(
  (acc, f) => ({ ...acc, [f.key]: "" }),
  {} as Record<FieldKey, string>,
);

const columns: DataTableColumn<ProductRow>[] = [
  { key: "sku", header: "SKU", accessor: (p) => p.sku },
  { key: "sn", header: "S/N", accessor: (p) => p.sn },
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
];

export default function Products() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<Record<FieldKey, string>>(EMPTY_FORM);
  const [snInput, setSnInput] = useState("");
  const [setInput, setSetInput] = useState(DEFAULT_SET);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const q = query(ref(rtdb, PRODUCTS_PATH), orderByChild("sn"));
    const unsubscribe = onValue(
      q,
      (snapshot) => {
        const rows: ProductRow[] = [];
        snapshot.forEach((child) => {
          rows.push({ id: child.key as string, ...(child.val() as Omit<ProductRow, "id">) });
        });
        setProducts(rows);
        setLoading(false);
        setLoadError(null);
      },
      () => {
        setLoading(false);
        setLoadError("Couldn't load products.");
      },
    );
    return unsubscribe;
  }, []);

  const nextSn = useMemo(
    () => (products.length === 0 ? 1 : Math.max(...products.map((p) => p.sn)) + 1),
    [products],
  );

  const existingSns = useMemo(() => new Set(products.map((p) => p.sn)), [products]);

  const snDuplicate = snInput.trim() !== "" && existingSns.has(Number(snInput));

  function updateField(key: FieldKey, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    for (const f of FIELDS) {
      if (f.required && !form[f.key].trim()) {
        setError(`${f.label} is required.`);
        return;
      }
    }

    const sn = snInput.trim() ? Number(snInput) : nextSn;
    if (!Number.isFinite(sn) || sn <= 0) {
      setError("S/N must be a positive number.");
      return;
    }
    if (existingSns.has(sn)) {
      setError(`S/N ${sn} is already used. Choose a different number.`);
      return;
    }

    const set = setInput.trim() ? Number(setInput) : 1;
    if (!Number.isInteger(set) || set <= 0) {
      setError("Set must be a positive whole number.");
      return;
    }

    setSaving(true);
    try {
      await push(ref(rtdb, PRODUCTS_PATH), {
        sn,
        ...form,
        set,
        createdAt: serverTimestamp(),
      });
      setForm(EMPTY_FORM);
      setSnInput("");
      setSetInput(DEFAULT_SET);
      setError(null);
    } catch {
      setError("Couldn't save product. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app-shell">
      <AppSidebar />
      <div className="app-content">
        <AppTopbar title="Products" />
        <main className={styles.content}>
          <p className={styles.intro}>Product catalog.</p>

          {!showForm && (
            <button type="button" className={`${styles.saveBtn} ${styles.addBtn}`} onClick={() => setShowForm(true)}>
              Add product
            </button>
          )}

          {showForm && (
            <section className={styles.card}>
              <div className={styles.cardHead}>
                <div>
                  <h3>Add product</h3>
                  <span className={styles.cardSub}>Enter a new row manually</span>
                </div>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowForm(false)}>
                  Cancel
                </button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className={styles.formGrid}>
                  <label className={styles.field}>
                    <span>S/N</span>
                    <input
                      type="number"
                      min={1}
                      placeholder={String(nextSn)}
                      value={snInput}
                      onChange={(e) => setSnInput(e.target.value)}
                      aria-invalid={snDuplicate}
                    />
                    {snDuplicate && <span className={styles.error}>S/N {snInput} is already used.</span>}
                  </label>
                  <label className={styles.field}>
                    <span>
                      Set (per pack)
                      <span className={styles.required}> *</span>
                    </span>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      required
                      value={setInput}
                      onChange={(e) => setSetInput(e.target.value)}
                    />
                  </label>
                  {FIELDS.map((f) => (
                    <label key={f.key} className={styles.field}>
                      <span>
                        {f.label}
                        {f.required && <span className={styles.required}> *</span>}
                      </span>
                      {f.options ? (
                        <select
                          required={f.required}
                          value={form[f.key]}
                          onChange={(e) => updateField(f.key, e.target.value)}
                        >
                          <option value="" disabled>
                            Select {f.label.toLowerCase()}
                          </option>
                          {f.options.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          required={f.required}
                          value={form[f.key]}
                          onChange={(e) => updateField(f.key, e.target.value)}
                        />
                      )}
                    </label>
                  ))}
                </div>
                {error && <p className={styles.error}>{error}</p>}
                <button type="submit" className={styles.saveBtn} disabled={saving || snDuplicate}>
                  {saving ? "Saving…" : "Add row"}
                </button>
              </form>
            </section>
          )}

          <section className={styles.card}>
            <div className={styles.cardHead}>
              <h3>Products</h3>
              <span className={styles.cardSub}>Product master list</span>
            </div>
            {loadError ? (
              <p className={styles.error}>{loadError}</p>
            ) : (
              <DataTable
                columns={columns}
                rows={products}
                rowKey={(p) => p.id}
                showSearch={false}
                emptyMessage={loading ? "Loading…" : "No products yet."}
              />
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
