import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { matches } from "../utils/search";
import styles from "./DtiItemPicker.module.css";

// One DTI item from GET /health/dti_items (the items on the Product Listing page).
export interface DtiItem {
  dtiItemCode: string;
  dtiItemDescription: string;
  division: string;
  /** Amazon product group of the item's listing; "" if it has none. */
  type: string;
  /** EAN of the item's listing; "" if it has none. */
  ean: string;
}

interface DtiItemPickerProps {
  items: DtiItem[];
  value: string;
  onSelect: (item: DtiItem) => void;
  loading?: boolean;
  error?: string;
  placeholder?: string;
  required?: boolean;
  /** Shows an × to clear the choice (for an optional picker). */
  onClear?: () => void;
}

// "DTI Item Code" drop-down on the AMAZON Listing form: a button that opens a
// pop-up list of Product Listing's DTI items, searchable by code or description.
// Keyboard: ↑/↓ to move, Enter to pick, Esc to close.
export default function DtiItemPicker({
  items,
  value,
  onSelect,
  loading,
  error,
  placeholder,
  required,
  onClear,
}: DtiItemPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = useMemo(
    () => items.filter((i) => matches(`${i.dtiItemCode} ${i.dtiItemDescription} ${i.division}`, query)),
    [items, query],
  );
  const selected = items.find((i) => i.dtiItemCode === value);

  // Close when clicking anywhere outside the picker.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // On open: fresh search, highlight the current value, focus the search box.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(Math.max(0, items.findIndex((i) => i.dtiItemCode === value)));
    searchRef.current?.focus();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => setActive(0), [query]);

  // Keep the highlighted option in view while arrowing through the list.
  useEffect(() => {
    listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function pick(item: DtiItem) {
    onSelect(item);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(filtered.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault(); // don't submit the surrounding form
      if (filtered[active]) pick(filtered[active]);
    }
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ""} ${onClear && value ? styles.triggerClearable : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-required={required}
      >
        {value ? (
          <span className={styles.value}>
            <strong>{value}</strong>
            {selected?.dtiItemDescription && <span className={styles.desc}>{selected.dtiItemDescription}</span>}
          </span>
        ) : (
          <span className={styles.placeholder}>{loading ? "Loading DTI items…" : placeholder || "Select a DTI item code"}</span>
        )}
        <ChevronDown size={16} className={styles.chevron} aria-hidden="true" />
      </button>
      {/* Sibling of the trigger, not inside it (a button can't contain a button). */}
      {onClear && value && (
        <button
          type="button"
          className={styles.clear}
          onClick={() => {
            onClear();
            setOpen(false);
          }}
          aria-label="Clear DTI item"
          title="Clear"
        >
          <X size={14} />
        </button>
      )}

      {open && (
        <div className={styles.popup} onKeyDown={onKeyDown}>
          <div className={styles.searchRow}>
            <Search size={15} className={styles.searchIcon} aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              className={styles.search}
              placeholder="Search code or description…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search DTI items"
            />
          </div>
          {error ? (
            <p className={styles.note}>{error}</p>
          ) : loading ? (
            <p className={styles.note}>Loading…</p>
          ) : filtered.length === 0 ? (
            <p className={styles.note}>No DTI items match “{query}”.</p>
          ) : (
            <ul className={styles.list} role="listbox" ref={listRef}>
              {filtered.map((i, idx) => (
                <li
                  key={i.dtiItemCode}
                  role="option"
                  aria-selected={i.dtiItemCode === value}
                  className={`${styles.option} ${idx === active ? styles.optionActive : ""} ${
                    i.dtiItemCode === value ? styles.optionSelected : ""
                  }`}
                  onMouseEnter={() => setActive(idx)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(i)}
                >
                  <span className={styles.code}>{i.dtiItemCode}</span>
                  <span className={styles.optDesc}>{i.dtiItemDescription}</span>
                  {i.division && <span className={styles.division}>{i.division}</span>}
                </li>
              ))}
            </ul>
          )}
          <div className={styles.footer}>
            {filtered.length} of {items.length} items from Product Listing
          </div>
        </div>
      )}
    </div>
  );
}
