import { useEffect, useState } from "react";
import type { OrderRow } from "../types";
import ExportCsvButton from "./ExportCsvButton";
import { matches } from "../utils/search";
import styles from "./RecentOrders.module.css";

interface Props {
  orders: OrderRow[];
}

const PAGE_SIZE = 5;

export default function RecentOrders({ orders }: Props) {
  const [query, setQuery] = useState("");
  const [dtiFilter, setDtiFilter] = useState("");
  const [page, setPage] = useState(1);

  const dtiOptions = Array.from(new Set(orders.map((o) => o.dtiItemCode))).sort();

  const filtered = orders
    .filter((o) => !dtiFilter || o.dtiItemCode === dtiFilter)
    .filter((o) => matches(`${o.id} ${o.sku} ${o.dtiItemCode} ${o.finish}`, query));

  // A new search term or DTI filter changes which orders match, so whatever
  // page we were on no longer means the same thing — back to 1.
  useEffect(() => {
    setPage(1);
  }, [query, dtiFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <h3>Recent orders</h3>
        <ExportCsvButton
          filename="recent-orders"
          rows={orders}
          columns={[
            { header: "SKU", value: (o) => o.sku },
            { header: "DTI Item Code", value: (o) => o.dtiItemCode },
            { header: "Order ID", value: (o) => o.id },
            { header: "Item", value: (o) => o.finish },
            { header: "Qty", value: (o) => o.qty },
            { header: "Total", value: (o) => o.total.toFixed(2) },
            { header: "Time", value: (o) => o.time },
          ]}
        />
      </div>

      <div className={styles.toolbar}>
        <input
          type="search"
          className={styles.search}
          placeholder="Search by item names or ID...."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search recent orders"
        />
        <select
          className={styles.filterSelect}
          value={dtiFilter}
          onChange={(e) => setDtiFilter(e.target.value)}
          aria-label="Filter by DTI item code"
        >
          <option value="">DTI item code: All</option>
          {dtiOptions.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className={styles.empty}>No orders match the current filters.</p>
      ) : (
        <>
          <div className={`${styles.row} ${styles.rowHead}`}>
            <span>Item</span>
            <span>SKU</span>
            <span>DTI item code</span>
            <span className={styles.priceHead}>Price</span>
          </div>
          <ul>
            {paged.map((o) => (
              <li key={o.id}>
                <div className={styles.row}>
                  <div className={styles.itemCol}>
                    <span className={styles.product}>{o.finish}</span>
                    <span className={styles.meta}>
                      {o.qty} unit{o.qty > 1 ? "s" : ""} · {o.time} · {o.id}
                    </span>
                  </div>
                  <span className={styles.cell}>{o.sku}</span>
                  <span className={styles.cell}>{o.dtiItemCode}</span>
                  <span className={styles.total}>${o.total.toFixed(2)}</span>
                </div>
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <span className={styles.pageInfo}>
                {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of{" "}
                {filtered.length}
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
        </>
      )}
    </div>
  );
}
