// Shared by the Products list (edit popup) and the Add product page: the row
// shape, the live products subscription, and the add/edit form itself.
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { onValue, orderByChild, query, ref } from "firebase/database";
import axios from "axios";
import api from "../api/client";
import DtiItemPicker, { type DtiItem } from "../components/DtiItemPicker";
import { rtdb } from "../firebase";
import styles from "./Products.module.css";

const PRODUCTS_PATH = "products";

export interface ProductRow {
  id: string;
  sn: number;
  sku: string;
  division: string;
  dtiItemCode: string;
  set: number;
  dtiItemDescription: string;
  /** Optional second DTI item (older rows don't have these). */
  dtiItemCode2?: string;
  dtiItemDescription2?: string;
  type: string;
  country: string;
  asin: string;
  fnsku: string;
  ean: string;
  description: string;
  status: string;
}

type FieldKey = Exclude<keyof ProductRow, "id" | "sn" | "set">;

export type ProductPayload = Omit<ProductRow, "id">;

const STATUS_OPTIONS = ["Active", "Inactive"];

// Fields that come from the chosen DTI item (Product Listing's data).
const DTI_LINKED_KEYS = ["dtiItemDescription", "division", "type", "ean"] as const;
type DtiLinkedKey = (typeof DTI_LINKED_KEYS)[number];
// Always read-only, even when the chosen item has no value for them.
const ALWAYS_LOCKED: readonly DtiLinkedKey[] = ["dtiItemDescription", "type"];

const DEFAULT_SET = "1";

// Every field is required except "fnsku" and "ean". "Set" is a number (qty per pack), required, defaults to 1.
const FIELDS: { key: FieldKey; label: string; required: boolean; options?: string[] }[] = [
  { key: "sku", label: "SKU", required: true },
  { key: "division", label: "Division", required: true },
  { key: "dtiItemCode", label: "DTI Item Code", required: true },
  { key: "dtiItemDescription", label: "DTI Item Description", required: true },
  { key: "dtiItemCode2", label: "2nd DTI Item Code", required: false },
  { key: "dtiItemDescription2", label: "2nd DTI Item Description", required: false },
  { key: "type", label: "Type", required: true },
  { key: "country", label: "Country", required: true },
  { key: "asin", label: "ASIN", required: true },
  { key: "fnsku", label: "FNSKU", required: false },
  { key: "ean", label: "EAN", required: false },
  { key: "description", label: "Description", required: true },
  { key: "status", label: "Status", required: true, options: STATUS_OPTIONS },
];

// How the fields are grouped on screen. "sn" and "set" are the two numeric
// inputs kept outside FIELDS; everything else refers to a FIELDS key.
type LayoutKey = FieldKey | "sn" | "set";
const SECTIONS: { title: string; keys: LayoutKey[] }[] = [
  { title: "Basics", keys: ["sn", "sku", "status"] },
  // Row 1: first DTI item + Division; row 2: second DTI item + Set; row 3: Type, Country.
  {
    title: "Item details",
    keys: ["dtiItemCode", "dtiItemDescription", "division", "dtiItemCode2", "dtiItemDescription2", "set", "type", "country"],
  },
  { title: "Marketplace identifiers", keys: ["asin", "fnsku", "ean"] },
  { title: "Description", keys: ["description"] },
];

// Small helper line shown under each box on the Add product page.
// PLACEHOLDER TEXT — edit these strings to whatever each field should say.
const HINTS: Record<LayoutKey, string> = {
  sn: "This is the Auto-increasement of the listing you can leave it blank.",
  sku: "This is the Amazon Listing code.",
  status: "Status of the product",
  division: "Type of the product",
  dtiItemCode: "Pick from the Product Listing items — fills in the description, division, type and EAN too.",
  set: "how many units come in one pack.",
  dtiItemDescription: "This is the description for the DTI code",
  dtiItemCode2: "Optional — a second DTI item in this product.",
  dtiItemDescription2: "Matches the 2nd DTI Item Code.",
  type: "Type of the product",
  country: "eg.US",
  asin: "10-character Amazon ID.",
  fnsku: " Amazon fulfillment label code.",
  ean: "barcode number.",
  description: "A short description of the product.",
};

// Greyed-out text inside each empty box. PLACEHOLDER TEXT — edit freely.
// (S/N's box always shows the next auto number instead; Status uses its dropdown prompt.)
const PLACEHOLDERS: Partial<Record<LayoutKey, string>> = {
  sku: "SKU-00001",
  status: "Select status",
  division: "DWL",
  dtiItemCode: "2-001",
  set: "1",
  dtiItemDescription: "DWL-001",
  type: "DWL Hardware",
  country: "US",
  asin: "ASIN-00001",
  fnsku: "FN-00001",
  ean: "EAN-00001",
  description: "Short description of the product…",
};

const EMPTY_FORM: Record<FieldKey, string> = FIELDS.reduce(
  (acc, f) => ({ ...acc, [f.key]: "" }),
  {} as Record<FieldKey, string>,
);

export function errorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    return (err.response?.data as { error?: string } | undefined)?.error || fallback;
  }
  return fallback;
}

/** Live list of products, ordered by S/N. Reads straight from RTDB (public read). */
export function useProducts() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  return { products, loading, loadError };
}

interface ProductFormProps {
  products: ProductRow[];
  /** The row being edited; omit to add a new one. */
  editing?: ProductRow | null;
  submitLabel: string;
  /** Resolve on success; throw to show the error in the form. */
  onSubmit: (payload: ProductPayload) => Promise<void>;
  onCancel: () => void;
  /** Clear the fields after a successful save (adding row after row). */
  resetOnSuccess?: boolean;
  /** Show the small helper line (HINTS) under each box. */
  showHints?: boolean;
}

export function ProductForm({
  products,
  editing,
  submitLabel,
  onSubmit,
  onCancel,
  resetOnSuccess,
  showHints,
}: ProductFormProps) {
  const [form, setForm] = useState<Record<FieldKey, string>>(() => {
    if (!editing) return EMPTY_FORM;
    const next = { ...EMPTY_FORM };
    for (const f of FIELDS) next[f.key] = editing[f.key] != null ? String(editing[f.key]) : "";
    return next;
  });
  const [snInput, setSnInput] = useState(editing ? String(editing.sn) : "");
  const [setInput, setSetInput] = useState(editing ? String(editing.set) : DEFAULT_SET);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // DTI items from the Product Listing page (core.items) for the DTI Item Code picker.
  const [dtiItems, setDtiItems] = useState<DtiItem[]>([]);
  const [dtiLoading, setDtiLoading] = useState(true);
  const [dtiError, setDtiError] = useState("");
  useEffect(() => {
    let cancelled = false;
    api
      .get<{ rows: DtiItem[] }>("/health/dti_items", { timeout: 30000 })
      .then(({ data }) => !cancelled && setDtiItems(data.rows))
      .catch((err) => !cancelled && setDtiError(errorMessage(err, "Couldn't load DTI items.")))
      .finally(() => !cancelled && setDtiLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  // The DTI item currently chosen in the picker (if it's one of Product Listing's).
  const matchedDti = dtiItems.find((i) => i.dtiItemCode === form.dtiItemCode);
  // The optional second DTI item. Division / Type / EAN still come from the first.
  const matchedDti2 = form.dtiItemCode2 ? dtiItems.find((i) => i.dtiItemCode === form.dtiItemCode2) : undefined;

  function pickDtiItem2(item: DtiItem | null) {
    setForm((prev) => ({
      ...prev,
      dtiItemCode2: item?.dtiItemCode ?? "",
      dtiItemDescription2: item?.dtiItemDescription ?? "",
    }));
  }

  // Picking a DTI item fills in its linked fields. Ones the item has no value
  // for (e.g. no Amazon listing yet) keep what was typed and stay editable.
  function pickDtiItem(item: DtiItem) {
    setForm((prev) => {
      const next = { ...prev, dtiItemCode: item.dtiItemCode };
      for (const k of DTI_LINKED_KEYS) next[k] = ALWAYS_LOCKED.includes(k) ? item[k] : item[k] || prev[k];
      return next;
    });
  }

  const nextSn = useMemo(
    () => (products.length === 0 ? 1 : Math.max(...products.map((p) => p.sn)) + 1),
    [products],
  );

  const existingSns = useMemo(
    () => new Set(products.filter((p) => p.id !== editing?.id).map((p) => p.sn)),
    [products, editing],
  );

  const snDuplicate = snInput.trim() !== "" && existingSns.has(Number(snInput));

  function updateField(key: FieldKey, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    for (const f of FIELDS) {
      // Type is filled from the DTI item and locked, so an item with no type
      // on Product Listing can still be saved with it blank.
      if (f.key === "type" && matchedDti) continue;
      if (f.required && !form[f.key].trim()) {
        setError(`${f.label} is required.`);
        return;
      }
    }

    // DTI Item Code must be one of Product Listing's items (an edited row may
    // keep an older code it already had).
    const code = form.dtiItemCode.trim();
    const keptOldCode = editing && code === editing.dtiItemCode;
    if (dtiItems.length > 0 && !keptOldCode && !dtiItems.some((i) => i.dtiItemCode === code)) {
      setError("Pick a DTI Item Code from the list (Product Listing's items).");
      return;
    }

    const code2 = form.dtiItemCode2.trim();
    if (code2) {
      if (code2 === code) {
        setError("The 2nd DTI Item Code must be different from the first.");
        return;
      }
      const keptOldCode2 = editing && code2 === editing.dtiItemCode2;
      if (dtiItems.length > 0 && !keptOldCode2 && !dtiItems.some((i) => i.dtiItemCode === code2)) {
        setError("Pick the 2nd DTI Item Code from the list (Product Listing's items).");
        return;
      }
    }

    // Linked fields always follow the chosen DTI item (2-001 -> DWL-001, DWL, …).
    const dtiItem = dtiItems.find((i) => i.dtiItemCode === code);
    const payloadForm = { ...form };
    if (dtiItem)
      for (const k of DTI_LINKED_KEYS) if (dtiItem[k] || ALWAYS_LOCKED.includes(k)) payloadForm[k] = dtiItem[k];
    const dtiItem2 = code2 ? dtiItems.find((i) => i.dtiItemCode === code2) : undefined;
    payloadForm.dtiItemCode2 = code2;
    payloadForm.dtiItemDescription2 = code2 ? (dtiItem2?.dtiItemDescription ?? form.dtiItemDescription2) : "";

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
    setError(null);
    try {
      await onSubmit({ sn, ...payloadForm, set });
      if (resetOnSuccess) {
        setForm(EMPTY_FORM);
        setSnInput("");
        setSetInput(DEFAULT_SET);
      }
    } catch (err) {
      setError(errorMessage(err, "Couldn't save product. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  function hint(key: LayoutKey) {
    return showHints && HINTS[key] ? <small className={styles.fieldHint}>{HINTS[key]}</small> : null;
  }

  function renderField(key: LayoutKey) {
    if (key === "sn") {
      return (
        <label key={key} className={styles.field}>
          <span className={styles.fieldLabel}>
            S/N <em className={styles.optional}>Auto: {nextSn}</em>
          </span>
          <input
            type="number"
            min={1}
            placeholder={String(nextSn)}
            value={snInput}
            onChange={(e) => setSnInput(e.target.value)}
            aria-invalid={snDuplicate}
          />
          {snDuplicate ? (
            <span className={styles.fieldError}>S/N {snInput} is already used.</span>
          ) : (
            hint(key)
          )}
        </label>
      );
    }
    if (key === "set") {
      return (
        <label key={key} className={styles.field}>
          <span className={styles.fieldLabel}>
            Set (per pack)
            <span className={styles.required}> *</span>
          </span>
          <input
            type="number"
            min={1}
            step={1}
            required
            placeholder={PLACEHOLDERS.set}
            value={setInput}
            onChange={(e) => setSetInput(e.target.value)}
          />
          {hint(key)}
        </label>
      );
    }
    if (key === "dtiItemCode") {
      // A <div>, not a <label>: a label would forward clicks inside the pop-up to the button.
      return (
        <div key={key} className={styles.field}>
          <span className={styles.fieldLabel}>
            DTI Item Code
            <span className={styles.required}> *</span>
          </span>
          <DtiItemPicker
            items={dtiItems}
            value={form.dtiItemCode}
            onSelect={pickDtiItem}
            loading={dtiLoading}
            error={dtiError}
            placeholder={`Select a DTI item code (e.g. ${PLACEHOLDERS.dtiItemCode})`}
            required
          />
          {hint(key)}
        </div>
      );
    }
    // Description / Division / Type / EAN: read-only, filled in from the chosen
    // DTI item. Description and Type are always locked; Division and EAN only
    // when the item has a value (otherwise they can still be typed in).
    if (key === "dtiItemCode2") {
      return (
        <div key={key} className={styles.field}>
          <span className={styles.fieldLabel}>
            2nd DTI Item Code <em className={styles.optional}>Optional</em>
          </span>
          <DtiItemPicker
            items={dtiItems.filter((i) => i.dtiItemCode !== form.dtiItemCode)}
            value={form.dtiItemCode2}
            onSelect={pickDtiItem2}
            onClear={() => pickDtiItem2(null)}
            loading={dtiLoading}
            error={dtiError}
            placeholder="Add a second DTI item (optional)"
          />
          {hint(key)}
        </div>
      );
    }
    if (key === "dtiItemDescription2") {
      return (
        <label key={key} className={styles.field}>
          <span className={styles.fieldLabel}>
            2nd DTI Item Description <em className={styles.optional}>Auto</em>
          </span>
          <input
            type="text"
            readOnly
            tabIndex={-1}
            className={styles.readOnlyInput}
            placeholder={form.dtiItemCode2 ? "None on Product Listing" : "Filled in from the 2nd DTI Item Code"}
            value={matchedDti2?.dtiItemDescription ?? form.dtiItemDescription2}
          />
          {hint(key)}
        </label>
      );
    }
    const linked = (DTI_LINKED_KEYS as readonly LayoutKey[]).includes(key) ? (key as DtiLinkedKey) : null;
    if (linked && (ALWAYS_LOCKED.includes(linked) || matchedDti?.[linked])) {
      const label = FIELDS.find((x) => x.key === linked)!.label;
      return (
        <label key={key} className={styles.field}>
          <span className={styles.fieldLabel}>
            {label} <em className={styles.optional}>Auto</em>
          </span>
          <input
            type="text"
            readOnly
            tabIndex={-1}
            className={styles.readOnlyInput}
            placeholder={matchedDti ? "None on Product Listing" : "Filled in from the DTI Item Code"}
            value={matchedDti ? matchedDti[linked] || (ALWAYS_LOCKED.includes(linked) ? "" : form[linked]) : form[linked]}
          />
          {showHints && <small className={styles.fieldHint}>Matches the DTI Item Code you pick.</small>}
        </label>
      );
    }
    const f = FIELDS.find((x) => x.key === key)!;
    const isDescription = key === "description";
    return (
      <label key={key} className={`${styles.field} ${isDescription ? styles.fieldFull : ""}`}>
        <span className={styles.fieldLabel}>
          {f.label}
          {f.required ? <span className={styles.required}> *</span> : <em className={styles.optional}>Optional</em>}
        </span>
        {f.options ? (
          <select required={f.required} value={form[f.key]} onChange={(e) => updateField(f.key, e.target.value)}>
            <option value="" disabled>
              {PLACEHOLDERS[key] ?? `Select ${f.label.toLowerCase()}`}
            </option>
            {f.options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        ) : isDescription ? (
          <textarea
            rows={3}
            required={f.required}
            placeholder={PLACEHOLDERS[key]}
            value={form[f.key]}
            onChange={(e) => updateField(f.key, e.target.value)}
          />
        ) : (
          <input
            type="text"
            required={f.required}
            placeholder={PLACEHOLDERS[key]}
            value={form[f.key]}
            onChange={(e) => updateField(f.key, e.target.value)}
          />
        )}
        {hint(key)}
      </label>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={styles.productForm}>
      {SECTIONS.map((section) => (
        <fieldset key={section.title} className={styles.formSection}>
          <legend className={styles.sectionTitle}>{section.title}</legend>
          <div className={styles.formGrid}>{section.keys.map(renderField)}</div>
        </fieldset>
      ))}
      {error && <p className={styles.formError}>{error}</p>}
      <div className={styles.formFooter}>
        <span className={styles.footerNote}>
          <span className={styles.required}>*</span> Required
        </span>
        <div className={styles.modalActions}>
          <button type="button" className={styles.cancelBtn} onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className={styles.saveBtn} disabled={saving || snDuplicate}>
            {saving ? "Saving…" : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
