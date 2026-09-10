import type { OrderRow, OrderStatus } from "../types";
import ExportCsvButton from "./ExportCsvButton";
import styles from "./RecentOrders.module.css";

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Pending",
  shipped: "Shipped",
  delivered: "Delivered",
  returned: "Returned",
};

interface Props {
  orders: OrderRow[];
}

export default function RecentOrders({ orders }: Props) {
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
            { header: "Status", value: (o) => STATUS_LABEL[o.status] },
            { header: "Time", value: (o) => o.time },
          ]}
        />
      </div>
      <ul>
        {orders.map((o) => (
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
              <span className={`${styles.badge} ${styles[o.status]}`}>{STATUS_LABEL[o.status]}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
