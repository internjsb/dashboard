import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import api from "../api/client";
import AppSidebar from "../components/AppSidebar";
import AppTopbar from "../components/AppTopbar";
import { errorMessage } from "./productForm";
import styles from "./AddListing.module.css";

type ListingKey = "division" | "dtiItemCode" | "dtiItemDescription" | "type" | "ean";

// Label, helper line and in-box placeholder for each field.
// PLACEHOLDER TEXT — edit the hint / placeholder strings freely.
const FIELDS: { key: ListingKey; label: string; hint: string; placeholder: string; required: boolean }[] = [
  { key: "division", label: "Division", hint: "This is the division of the item.", placeholder: "Enter a division like DWL", required: true },
  { key: "dtiItemCode", label: "DTI item", hint: "This is the DTI code of the item.", placeholder: "Enter a code like 2-001", required: true },
  {
    key: "dtiItemDescription",
    label: "DTI Item Description",
    hint: "This is the DTI description of the item.",
    placeholder: "Enter a description like DWL-001",
    required: true,
  },
  { key: "type", label: "Type", hint: "This is the type of the item.", placeholder: "Enter a type like DWL Hardware", required: true },
  { key: "ean", label: "EAN", hint: "This is the barcode number of the item.", placeholder: "Enter an EAN like 0000000000000", required: false },
];

const EMPTY: Record<ListingKey, string> = { division: "", dtiItemCode: "", dtiItemDescription: "", type: "", ean: "" };

type ListingRow = {
  division: string | null;
  dti_item_code: string | null;
  dti_item_description: string | null;
  type?: string | null;
  ean?: string | null;
};

const toForm = (row: ListingRow): Record<ListingKey, string> => ({
  division: row.division ?? "",
  dtiItemCode: row.dti_item_code ?? "",
  dtiItemDescription: row.dti_item_description ?? "",
  type: row.type ?? "",
  ean: row.ean ?? "",
});

// "Add a new product" for Product Listing — saved to Postgres:
//   /product-listings/new             -> POST  /dashboard/listing-items (core.items)
//   /product-listings/:id/edit        -> PATCH /dashboard/listing-items/:code (id = DTI item code)
//   /product-listings/amazon/:sku/edit -> PATCH /dashboard/listing-data/:sku
// Division follows the DTI Item Description; the database has no photo storage yet.
export default function AddListing() {
  const navigate = useNavigate();
  const { id: editCode, sku: amazonSku } = useParams();
  const isAmazon = !!amazonSku;
  const isEdit = !!editCode || isAmazon;
  // The row's No. in the listing table when Edit was clicked (for the audit log).
  const rowNo = (useLocation().state as { no?: number } | null)?.no;
  const [form, setForm] = useState<Record<ListingKey, string>>(EMPTY);
  const [loadingRow, setLoadingRow] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Edit: load the row's current values from Cloud SQL.
  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    const url = isAmazon
      ? `/dashboard/listing-data/${encodeURIComponent(amazonSku!)}`
      : `/dashboard/listing-items/${encodeURIComponent(editCode!)}`;
    api
      .get<{ row: ListingRow }>(url, { timeout: 30000 })
      .then(({ data }) => !cancelled && setForm(toForm(data.row)))
      .catch((err) => !cancelled && setError(errorMessage(err, isAmazon ? "Couldn't load this Amazon listing." : "Couldn't load this listing.")))
      .finally(() => !cancelled && setLoadingRow(false));
    return () => {
      cancelled = true;
    };
  }, [isEdit, isAmazon, amazonSku, editCode]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (isAmazon) {
        // core.items / core.item_sku_map
        await api.patch(
          `/dashboard/listing-data/${encodeURIComponent(amazonSku!)}`,
          { dtiItemCode: form.dtiItemCode, dtiItemDescription: form.dtiItemDescription, ean: form.ean, type: form.type, rowNo },
          { timeout: 30000 },
        );
      } else if (isEdit) {
        await api.patch(
          `/dashboard/listing-items/${encodeURIComponent(editCode!)}`,
          { dtiItemCode: form.dtiItemCode, dtiItemDescription: form.dtiItemDescription, rowNo },
          { timeout: 30000 },
        );
      } else {
        await api.post(
          "/dashboard/listing-items",
          { dtiItemCode: form.dtiItemCode, dtiItemDescription: form.dtiItemDescription },
          { timeout: 30000 },
        );
      }
      // Back to the listing; it shows a short note for this row.
      navigate("/product-listings", { state: { [isEdit ? "updated" : "added"]: form.dtiItemCode || amazonSku } });
    } catch (err) {
      setError(
        errorMessage(
          err,
          isAmazon
            ? "Couldn't save changes to the database. Please try again."
            : isEdit
              ? "Couldn't save changes. Please try again."
              : "Couldn't add the row. Please try again.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  // Your items only store DTI item + description; Type / EAN come from Amazon.
  const fields = isAmazon ? FIELDS : FIELDS.filter((f) => f.key !== "type" && f.key !== "ean");

  return (
    <div className="app-shell">
      <AppSidebar />
      <div className="app-content">
        <AppTopbar title="Product Listing" />
        <main className={styles.content}>
          <Link to="/product-listings" className={styles.backLink}>
            <ArrowLeft size={15} aria-hidden="true" />
            Back to Product Listing
          </Link>

          <form className={styles.layout} onSubmit={handleSubmit}>
            <section className={styles.imageSide}>
              <div className={styles.sideHead}>
                <h2 className={styles.heading}>{isEdit ? "Edit product" : "Add a new product"}</h2>
                <p className={styles.subheading}>
                  {isAmazon
                    ? `Amazon listing ${amazonSku} — changes are saved to the database (Cloud SQL).`
                    : isEdit
                      ? "Update the listing details — changes are saved to the database (Cloud SQL)."
                      : "Add the listing details — the row is saved to the database (Cloud SQL)."}
                </p>
              </div>

              <div className={styles.amazonNote}>
                <strong>Photos</strong>
                <span>Listings are stored in the database, which doesn't have a place for photos yet.</span>
              </div>
            </section>

            <section className={styles.fieldsSide}>
              <div className={styles.sideHead}>
                <h3 className={styles.detailsTitle}>Product details</h3>
                <p className={styles.subheading}>Fields marked optional can be left blank.</p>
              </div>

              {/* Two columns; the description spans both. */}
              <div className={styles.fieldGrid}>
                {fields.map((f) => {
                  const wide = f.key === "dtiItemDescription" ? styles.wide : "";
                  return f.key === "division" ? (
                    <div key={f.key} className={`${styles.field} ${wide}`}>
                      <span className={styles.label}>
                        {f.label}
                        <em className={styles.optional}>Auto</em>
                      </span>
                      <span className={styles.readOnly}>
                        {form.dtiItemDescription.split("-")[0].replace(/NIST$/, "") || "—"}
                      </span>
                      <span className={styles.hint}>From the start of the description (DWL-001 → DWL).</span>
                    </div>
                  ) : (
                    <label key={f.key} className={`${styles.field} ${wide}`}>
                      <span className={styles.label}>
                        {f.label}
                        {!f.required && <em className={styles.optional}>Optional</em>}
                      </span>
                      <input
                        type="text"
                        required={isAmazon ? f.key === "dtiItemCode" || f.key === "dtiItemDescription" : f.required}
                        placeholder={f.placeholder}
                        value={form[f.key]}
                        onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                      />
                      <span className={styles.hint}>
                        {isAmazon && f.key === "dtiItemDescription"
                          ? "Changes this item's description for every SKU that uses it."
                          : isAmazon && (f.key === "ean" || f.key === "type")
                            ? "Leave blank to use Amazon's value."
                            : f.hint}
                      </span>
                    </label>
                  );
                })}
              </div>

              {error && <p className={styles.error}>{error}</p>}

              <div className={styles.footer}>
                <button type="button" className={styles.cancelBtn} onClick={() => navigate("/product-listings")} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className={styles.addRow} disabled={saving || loadingRow}>
                  {saving ? "Saving…" : isEdit ? "Save changes" : "Add row"}
                </button>
              </div>
            </section>
          </form>
        </main>
      </div>
    </div>
  );
}
