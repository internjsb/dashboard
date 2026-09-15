import { useState } from "react";
import type { OrderRow } from "../types";
import ExportCsvButton from "./ExportCsvButton";
import { matches } from "../utils/search";
import styles from "./RecentOrders.module.css";

interface Props {
  orders: OrderRow[];
}

export default function RecentOrders({ orders }: Props) {
  const [query, setQuery] = useState("");
  const filtered = orders.filter((o) => matches(`${o.id} ${o.finish}`, query));

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <h3>Recent orders</h3>
        <ExportCsvButton
          filename="recent-orders"
          rows={orders}
          columns={[
            { header: "Order ID", value: (o) => o.id },
            { header: "Item", value: (o) => o.finish },
            { header: "Qty", value: (o) => o.qty },
            { header: "Total", value: (o) => o.total.toFixed(2) },
            { header: "Time", value: (o) => o.time },
          ]}
        />
      </div>

      <input
        type="search"
        className={styles.search}
        placeholder="Search by item names or ID...."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search recent orders"
      />

      {filtered.length === 0 ? (
        <p className={styles.empty}>No orders match “{query}”.</p>
      ) : (
        <ul>
          {filtered.map((o) => (
            <li key={o.id}>
              <div className={styles.line}>
                <span className={styles.product}>
                  {o.finish} <span className={styles.orderId}>· {o.id}</span>
                </span>
                <span className={styles.total}>${o.total.toFixed(2)}</span>
              </div>
              <div className={styles.line}>
                <span className={styles.meta}>
                  {o.qty} unit{o.qty > 1 ? "s" : ""} · {o.time}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
