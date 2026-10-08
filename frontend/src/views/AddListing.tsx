import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ImagePlus, Upload, X } from "lucide-react";
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

// PNG and JPG only — WEBP and GIF are not accepted (backend enforces the same).
const IMAGE_TYPES = ["image/png", "image/jpeg"];
const MAX_IMAGE_MB = 5;

const EMPTY: Record<ListingKey, string> = { division: "", dtiItemCode: "", dtiItemDescription: "", type: "", ean: "" };

// "Add a new product" for AMAZON Listing: image on the left, the five listing
// fields on the right. The image is uploaded with the row (multipart) and the
// backend stores it in Firebase Storage. Also serves /product-listings/:id/edit,
// where the same form is pre-filled and the current image can be kept,
// replaced or removed.
export default function AddListing() {
  const navigate = useNavigate();
  const { id: editId } = useParams();
  const isEdit = !!editId;
  // The row's No. in the listing table when Edit was clicked (for the audit log).
  const rowNo = (useLocation().state as { no?: number } | null)?.no;
  const [form, setForm] = useState(EMPTY);
  const [image, setImage] = useState<File | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  // Edit mode: the image already saved on the row, until replaced/removed.
  const [savedImageUrl, setSavedImageUrl] = useState<string | null>(null);
  const [removeSaved, setRemoveSaved] = useState(false);
  const [loadingRow, setLoadingRow] = useState(isEdit);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!image) {
      setLocalPreview(null);
      return;
    }
    const url = URL.createObjectURL(image);
    setLocalPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    api
      .get<{ row: Record<ListingKey, string> & { imageUrl: string | null } }>(`/dashboard/listings/${editId}`)
      .then(({ data }) => {
        if (cancelled) return;
        const next = { ...EMPTY };
        for (const f of FIELDS) next[f.key] = data.row[f.key] ?? "";
        setForm(next);
        setSavedImageUrl(data.row.imageUrl);
      })
      .catch((err) => !cancelled && setError(errorMessage(err, "Couldn't load this listing.")))
      .finally(() => !cancelled && setLoadingRow(false));
    return () => {
      cancelled = true;
    };
  }, [editId]);

  const preview = localPreview || (!removeSaved ? savedImageUrl : null);
  const hasAnyImage = !!image || (!!savedImageUrl && !removeSaved);

  function clearImage() {
    setImage(null);
    if (savedImageUrl) setRemoveSaved(true);
  }

  function pickFile(file: File | undefined) {
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) {
      setError("Please choose a PNG or JPG image.");
      return;
    }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      setError(`Image must be ${MAX_IMAGE_MB} MB or smaller.`);
      return;
    }
    setError("");
    setImage(file);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    pickFile(e.dataTransfer.files[0]);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const body = new FormData();
      for (const [key, value] of Object.entries(form)) body.append(key, value);
      body.append("hasImage", image ? "true" : "false");
      if (image) body.append("image", image);
      // Uploads can take longer than the client's default 10s timeout.
      if (isEdit) {
        if (removeSaved && !image) body.append("removeImage", "true");
        if (rowNo) body.append("rowNo", String(rowNo));
        await api.patch(`/dashboard/listings/${editId}`, body, { timeout: 60000 });
      } else {
        await api.post("/dashboard/listings", body, { timeout: 60000 });
      }
      // Back to the listing; it shows a short note for this row.
      navigate("/product-listings", { state: { [isEdit ? "updated" : "added"]: form.dtiItemCode } });
    } catch (err) {
      setError(errorMessage(err, isEdit ? "Couldn't save changes. Please try again." : "Couldn't add the row. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app-shell">
      <AppSidebar />
      <div className="app-content">
        <AppTopbar title="AMAZON Listing" />
        <main className={styles.content}>
          <Link to="/product-listings" className={styles.backLink}>
            <ArrowLeft size={15} aria-hidden="true" />
            Back to AMAZON Listing
          </Link>

          <form className={styles.layout} onSubmit={handleSubmit}>
            <section className={styles.imageSide}>
              <div className={styles.sideHead}>
                <h2 className={styles.heading}>{isEdit ? "Edit product" : "Add a new product"}</h2>
                <p className={styles.subheading}>
                  {isEdit ? "Update the image or listing details." : "Add a product image and its listing details."}
                </p>
              </div>

              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/jpeg"
                hidden
                onChange={(e) => {
                  pickFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />

              <button
                type="button"
                className={`${styles.dropZone} ${dragging ? styles.dropZoneActive : ""} ${preview ? styles.hasPreview : ""}`}
                onClick={() => fileInput.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                aria-label={preview ? "Change image" : "Browse for an image"}
              >
                {preview ? (
                  <>
                    <img src={preview} alt="" className={styles.preview} />
                    <span className={styles.changeBadge}>Change image</span>
                  </>
                ) : (
                  <span className={styles.dropInner}>
                    <span className={styles.dropIcon}>
                      <ImagePlus size={30} aria-hidden="true" />
                    </span>
                    <span className={styles.dropTitle}>{dragging ? "Drop to add image" : "Drag & drop an image"}</span>
                    <span className={styles.dropSub}>
                      or <span className={styles.browse}>browse</span> from your computer
                    </span>
                    <span className={styles.dropMeta}>PNG or JPG · up to {MAX_IMAGE_MB} MB</span>
                  </span>
                )}
              </button>

              <div className={styles.imageActions}>
                <button type="button" className={styles.uploadBtn} onClick={() => fileInput.current?.click()}>
                  <Upload size={16} aria-hidden="true" />
                  Upload image
                </button>
                {hasAnyImage && (
                  <button type="button" className={styles.removeImage} onClick={clearImage}>
                    <X size={14} aria-hidden="true" />
                    Remove
                  </button>
                )}
              </div>
              <p className={styles.imageNote}>
                {image ? (
                  <span className={styles.fileName}>
                    {image.name} · {(image.size / 1024 / 1024).toFixed(1)} MB
                  </span>
                ) : (
                  "Optional — you can add a row without an image."
                )}
              </p>
            </section>

            <section className={styles.fieldsSide}>
              <div className={styles.sideHead}>
                <h3 className={styles.detailsTitle}>Product details</h3>
                <p className={styles.subheading}>Fields marked optional can be left blank.</p>
              </div>

              {FIELDS.map((f) => (
                <label key={f.key} className={styles.field}>
                  <span className={styles.label}>
                    {f.label}
                    {!f.required && <em className={styles.optional}>Optional</em>}
                  </span>
                  <span className={styles.hint}>{f.hint}</span>
                  <input
                    type="text"
                    required={f.required}
                    placeholder={f.placeholder}
                    value={form[f.key]}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  />
                </label>
              ))}

              {error && <p className={styles.error}>{error}</p>}

              <div className={styles.footer}>
                <button type="button" className={styles.cancelBtn} onClick={() => navigate("/product-listings")} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className={styles.addRow} disabled={saving || loadingRow}>
                  {saving ? (image ? "Uploading…" : "Saving…") : isEdit ? "Save changes" : "Add row"}
                </button>
              </div>
            </section>
          </form>
        </main>
      </div>
    </div>
  );
}
