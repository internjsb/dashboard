// Turn an array of rows into a CSV file the browser downloads. No backend and
// no dependencies — build the text, wrap it in a Blob, click a temporary link.

export interface CsvColumn<T> {
  /** Header text for the column. */
  header: string;
  /** Cell value for a row. Return a string, number, or null/undefined for blank. */
  value: (row: T) => string | number | null | undefined;
}

function escapeCell(input: string | number | null | undefined): string {
  const s = input == null ? "" : String(input);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const head = columns.map((c) => escapeCell(c.header)).join(",");
  const body = rows.map((row) => columns.map((c) => escapeCell(c.value(row))).join(","));
  return [head, ...body].join("\r\n");
}

export function downloadCsv<T>(filename: string, rows: T[], columns: CsvColumn<T>[]): void {
  // Prepend a UTF-8 BOM so Excel opens accented characters correctly.
  const blob = new Blob(["﻿" + toCsv(rows, columns)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
