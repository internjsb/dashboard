import { useEffect, useState } from "react";
import api from "../api/client";
import ExportCsvButton from "./ExportCsvButton";
import { matches } from "../utils/search";
import { inMarketplace, useMarketplace } from "../hooks/useMarketplace";
import styles from "./RecentOrders.module.css";

// One row from GET /health/recent_order — the query returns exactly these columns.
interface OrderRow {
  // id: string;
  item_name: string;
  sku: string;
  dtiItemCode: string; // e.g. "2-011"
  qty: number; // units per SKU (core.item_sku_map)
  Price: number; // the order line's item price
  marketplace_id: string | null; // not shown; used by the top-bar marketplace filter
}

const PAGE_SIZE = 5;

export default function RecentOrders() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [dtiFilter, setDtiFilter] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ rows: OrderRow[] }>("/health/recent_order", { timeout: 30000 })
      .then(({ data }) => !cancelled && setOrders(data.rows))
      .catch(() => !cancelled && setError("Couldn't load recent orders."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const { code } = useMarketplace();
  const marketOrders = orders.filter((o) => inMarketplace(code, o.marketplace_id));
  const dtiOptions = Array.from(new Set(marketOrders.map((o) => o.dtiItemCode))).sort();

  const filtered = marketOrders
    .filter((o) => !dtiFilter || o.dtiItemCode === dtiFilter)
    .filter((o) => matches(`${o.Price} ${o.sku} ${o.dtiItemCode} ${o.item_name}`, query));


  // ${o.id}
  // A new search term or DTI filter changes which orders match, so whatever
  // page we were on no longer means the same thing — back to 1.
  useEffect(() => {
    setPage(1);
  }, [query, dtiFilter, code]);

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
            { header: "Item", value: (o) => o.item_name },
            { header: "SKU", value: (o) => o.sku },
            { header: "Product Item Code", value: (o) => o.dtiItemCode },
            { header: "Qty", value: (o) => o.qty },
            { header: "Price", value: (o) => o.Price.toFixed(2) },
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
          aria-label="Filter by Product item code"
        >
          <option value="">Product Item code: All</option>
          {dtiOptions.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className={styles.empty}>Loading…</p>
      ) : error ? (
        <p className={styles.empty}>{error}</p>
      ) : filtered.length === 0 ? (
        <p className={styles.empty}>No orders match the current filters.</p>
      ) : (
        <>
          <div className={`${styles.row} ${styles.rowHead}`}>
            <span>Item Name</span>
            <span>SKU</span>
            <span>Product item code</span>
            <span className={styles.priceHead}>Total Price</span>
          </div>
          <ul>
            {paged.map((o, i) => (
              // No id from the query, so SKU + position is the key.
              <li key={`${o.sku}-${(currentPage - 1) * PAGE_SIZE + i}`}>
                <div className={styles.row}>
                  <div className={styles.itemCol}>
                    <span className={styles.product}>{o.item_name}</span>
                    <span className={styles.meta}>
                      {o.qty} unit{o.qty === 1 ? "" : "s"} × ${o.Price.toFixed(2)}
                    </span>
                  </div>
                  <span className={styles.cell}>{o.sku}</span>
                  <span className={styles.cell}>{o.dtiItemCode}</span>
                  <span className={styles.total}>${o.Price.toFixed(2)}</span>
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
