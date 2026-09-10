import { downloadCsv, type CsvColumn } from "../utils/csv";
import styles from "./ExportCsvButton.module.css";

interface Props<T> {
  filename: string;
  rows: T[];
  columns: CsvColumn<T>[];
  label?: string;
}

export default function ExportCsvButton<T>({ filename, rows, columns, label = "Export CSV" }: Props<T>) {
  return (
    <button
      type="button"
      className={styles.button}
      disabled={rows.length === 0}
      onClick={() => downloadCsv(filename, rows, columns)}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      {label}
    </button>
  );
}
