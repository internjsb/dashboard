import styles from "./SegmentSearchBar.module.css";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/**
 * The "search this page" bar used on Dashboard and Sales history: typing a
 * term isolates the matching KPI tile(s) and section(s) on the page.
 */
export default function SegmentSearchBar({ value, onChange, placeholder = "Search…" }: Props) {
  return (
    <div className={styles.bar}>
      <svg
        className={styles.icon}
        width="15"
        height="15"
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
        className={styles.input}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Search"
      />
    </div>
  );
}
