import { useEffect, useMemo, useState, type ReactNode } from "react";
import styles from "./DataTable.module.css";

export type SortDir = "asc" | "desc";
type CellValue = string | number | null | undefined;

export interface DataTableColumn<T> {
  /** Stable id — used as the React key and to track sort state. */
  key: string;
  header: ReactNode;
  /** Value backing sort + search. Omit for columns that are neither (e.g. an actions column). */
  accessor?: (row: T) => CellValue;
  /** Custom cell content. Defaults to the accessor's value. */
  render?: (row: T) => ReactNode;
  /** Default: true whenever accessor is set. */
  sortable?: boolean;
  /** Default: true whenever accessor is set. */
  searchable?: boolean;
  align?: "left" | "right";
  /** Pin this column to the table's right edge while the rest scrolls sideways (e.g. an actions column). */
  sticky?: "right";
  /** Extra class applied to both the <th> and every <td> in this column. */
  className?: string;
}

export interface DataTableFilter<T> {
  key: string;
  label: string;
  accessor: (row: T) => string;
  options: { value: string; label: string }[];
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Set false to hide the search box entirely. Default true. */
  showSearch?: boolean;
  searchPlaceholder?: string;
  filters?: DataTableFilter<T>[];
  emptyMessage?: string;
  /** Extra toolbar content (e.g. a CSV export button) shown after the filters. */
  toolbarExtra?: ReactNode;
  rowClassName?: (row: T) => string;
  defaultSort?: { key: string; dir: SortDir };
  /** Rows per page. Set to 0 to disable pagination entirely. Default 10. */
  pageSize?: number;
}

export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  showSearch = true,
  searchPlaceholder = "Search…",
  filters,
  emptyMessage = "No results.",
  toolbarExtra,
  rowClassName,
  defaultSort,
  pageSize = 10,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<{ key: string; dir: SortDir } | null>(defaultSort ?? null);
  const [page, setPage] = useState(1);

  // A new search term or filter selection changes which rows match, so
  // whatever page we were on no longer means the same thing — back to 1.
  useEffect(() => {
    setPage(1);
  }, [search, JSON.stringify(filterValues)]);

  function toggleSort(col: DataTableColumn<T>) {
    if (col.sortable === false || !col.accessor) return;
    setSort((prev) => {
      if (!prev || prev.key !== col.key) return { key: col.key, dir: "asc" };
      if (prev.dir === "asc") return { key: col.key, dir: "desc" };
      return null; // third click: back to unsorted (original order)
    });
  }

  const filtered = useMemo(() => {
    let out = rows;

    if (filters) {
      for (const f of filters) {
        const v = filterValues[f.key];
        if (v) out = out.filter((r) => f.accessor(r) === v);
      }
    }

    const q = search.trim().toLowerCase();
    if (q) {
      const searchCols = columns.filter((c) => c.accessor && c.searchable !== false);
      out = out.filter((r) =>
        searchCols.some((c) => String(c.accessor!(r) ?? "").toLowerCase().includes(q)),
      );
    }

    return out;
  }, [rows, search, filterValues, columns, filters]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.accessor) return filtered;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = col.accessor!(a);
      const bv = col.accessor!(b);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av ?? "").localeCompare(String(bv ?? "")) * dir;
    });
  }, [filtered, sort, columns]);

  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(() => {
    if (pageSize <= 0) return sorted;
    const start = (currentPage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, currentPage, pageSize]);

  const showToolbar =
    (showSearch && columns.some((c) => c.searchable !== false && c.accessor)) ||
    !!filters?.length ||
    !!toolbarExtra;
  const showPagination = pageSize > 0 && sorted.length > pageSize;

  return (
    <div className={styles.wrap}>
      {showToolbar && (
        <div className={styles.toolbar}>
          {showSearch && (
            <input
              type="search"
              className={styles.search}
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search"
            />
          )}
          {filters?.map((f) => (
            <select
              key={f.key}
              className={styles.filterSelect}
              value={filterValues[f.key] ?? ""}
              onChange={(e) => setFilterValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
              aria-label={f.label}
            >
              <option value="">{f.label}: All</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ))}
          {toolbarExtra && <div className={styles.toolbarExtra}>{toolbarExtra}</div>}
        </div>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              {columns.map((c) => {
                const canSort = c.sortable !== false && !!c.accessor;
                const active = sort?.key === c.key;
                return (
                  <th
                    key={c.key}
                    className={`${c.className ?? ""} ${c.align === "right" ? styles.right : ""} ${
                      canSort ? styles.sortableTh : ""
                    } ${c.sticky === "right" ? styles.stickyRight : ""}`}
                    onClick={canSort ? () => toggleSort(c) : undefined}
                    aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : undefined}
                  >
                    <span className={styles.thInner}>
                      {c.header}
                      {canSort && (
                        <span className={`${styles.sortIcon} ${active ? styles.sortIconActive : ""}`}>
                          {active ? (sort!.dir === "asc" ? "▲" : "▼") : "⇅"}
                        </span>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td className={styles.empty} colSpan={columns.length}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paged.map((row) => (
                <tr key={rowKey(row)} className={rowClassName?.(row) ?? ""}>
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={`${c.className ?? ""} ${c.align === "right" ? styles.right : ""} ${
                        c.sticky === "right" ? styles.stickyRight : ""
                      }`}
                    >
                      {c.render ? c.render(row) : (c.accessor?.(row) ?? "—")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showPagination && (
        <div className={styles.pagination}>
          <span className={styles.pageInfo}>
            {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, sorted.length)} of {sorted.length}
          </span>
          <div className={styles.pageBtns}>
            <button
              type="button"
              className={styles.pageBtn}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
            >
              Prev
            </button>
            <span className={styles.pageCount}>
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              className={styles.pageBtn}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
