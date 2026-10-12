import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import api from "../api/client";
import AppSidebar from "../components/AppSidebar";
import AppTopbar from "../components/AppTopbar";
import DataTable, { type DataTableColumn, type DataTableFilter } from "../components/DataTable";
import ExportCsvButton from "../components/ExportCsvButton";
import { errorMessage } from "./productForm";
import styles from "./Inventory.module.css";

// One row per SKU from GET /api/health/inventory_data (Cloud SQL).
interface InventoryRow {
  sku: string;
  item_name: string | null;
  country: string | null;
  warehouse_quantity: number | null;
  fulfillable_quantity: number | null;
  unsellable_quantity: number | null;
  reserved_quantity: number | null;
}

// One row per shipped order line from GET /api/health/shipment_data (Cloud SQL).
interface Shipement {
  sku: string;
  order_id: string | null;
  product_name: string | null;
  shipment_qty: number | null;
  tracking_number: string | null;
  currency: string | null; // e.g. "USD"
  purchase_date: string | null; // ISO timestamp (JSON has no Date type)
  sales_channel: string | null;
}

function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";
}

// yyyy-mm-dd in local time (what <input type="date"> gives), so the filter
// matches the date shown in the table.
function isoDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoDay(d);
};

// Same quick ranges as the Sale Report.
const DATE_PRESETS: { label: string; range: () => [string, string] }[] = [
  { label: "Last 7 days", range: () => [daysAgo(6), isoDay(new Date())] },
  { label: "Last 30 days", range: () => [daysAgo(29), isoDay(new Date())] },
  {
    label: "This month",
    range: () => {
      const now = new Date();
      return [isoDay(new Date(now.getFullYear(), now.getMonth(), 1)), isoDay(now)];
    },
  },
];

function num(n: number | null): string {
  return n == null ? "—" : Number(n).toLocaleString();
}

// GET `url` -> { rows }; re-fetches when `nonce` changes (the Refresh button).
function useRows<T>(url: string, nonce: number, fallbackError: string) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    api
      .get<{ rows: T[] }>(url, { timeout: 30000 })
      .then(({ data }) => !cancelled && setRows(data.rows))
      .catch((err) => !cancelled && setError(errorMessage(err, fallbackError)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [url, nonce, fallbackError]);

  return { rows, loading, error };
}

export default function Inventory() {
  const [nonce, setNonce] = useState(0);
  const {
    rows: inventory,
    loading: inventoryLoading,
    error: inventoryError,
  } = useRows<InventoryRow>("/health/inventory_data", nonce, "Couldn't load inventory.");
  const {
    rows: shipments,
    loading: shipmentsLoading,
    error: shipmentsError,
  } = useRows<Shipement>("/health/shipment_data", nonce, "Couldn't load shipments.");

  // Purchase-date range for the Shipments table ("" = open-ended).
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const filteredShipments = useMemo(
    () =>
      shipments.filter((s) => {
        if (!fromDate && !toDate) return true;
        if (!s.purchase_date) return false;
        const day = isoDay(new Date(s.purchase_date));
        return (!fromDate || day >= fromDate) && (!toDate || day <= toDate);
      }),
    [shipments, fromDate, toDate],
  );
  const hasDateFilter = !!(fromDate || toDate);

  const loading = inventoryLoading || shipmentsLoading;
  const reload = () => setNonce((n) => n + 1);

  const qtyCol = (key: keyof InventoryRow, header: string): DataTableColumn<InventoryRow> => ({
    key,
    header,
    accessor: (i) => Number(i[key] ?? 0),
    align: "right",
    className: styles.numCol,
    render: (i) => num(i[key] as number | null),
  });

  const inventoryColumns: DataTableColumn<InventoryRow>[] = [
    { key: "sku", header: "SKU", accessor: (i) => i.sku },
    { key: "item_name", header: "Item Name", accessor: (i) => i.item_name ?? "" },
    { key: "country", header: "Country", accessor: (i) => i.country ?? "", render: (i) => i.country || "—" },
    qtyCol("warehouse_quantity", "Warehouse Qty"),
    qtyCol("fulfillable_quantity", "Fulfillable Qty"),
    qtyCol("unsellable_quantity", "Unsellable Qty"),
    qtyCol("reserved_quantity", "Reserved Qty"),
  ];

  const inventoryFilters: DataTableFilter<InventoryRow>[] = [
    {
      key: "country",
      label: "Country",
      accessor: (i) => i.country ?? "",
      options: Array.from(new Set(inventory.map((i) => i.country).filter((c): c is string => !!c)))
        .sort()
        .map((c) => ({ value: c, label: c })),
    },
  ];

  const shipmentColumns: DataTableColumn<Shipement>[] = [
    { key: "sku", header: "SKU", accessor: (s) => s.sku },
    { key: "order_id", header: "Order ID", accessor: (s) => s.order_id ?? "" },
    { key: "product_name", header: "Product Name", accessor: (s) => s.product_name ?? "" },
    {
      key: "shipment_qty",
      header: "Shipment Qty",
      accessor: (s) => Number(s.shipment_qty ?? 0),
      align: "right",
      className: styles.numCol,
      render: (s) => num(s.shipment_qty),
    },
    { key: "tracking_number", header: "Tracking Number", accessor: (s) => s.tracking_number ?? "", className: styles.muted },
    { key: "currency", header: "Currency", accessor: (s) => s.currency ?? "" },
    {
      key: "purchase_date",
      header: "Purchase Date",
      // ISO strings sort correctly as text.
      accessor: (s) => s.purchase_date ?? "",
      render: (s) => formatDate(s.purchase_date),
      searchable: false,
    },
    { key: "sales_channel", header: "Sales Channel", accessor: (s) => s.sales_channel ?? "" },
  ];

  return (
    <div className="app-shell">
      <AppSidebar />
      <div className="app-content">
        <AppTopbar title="Inventory" />
        <main className={styles.content}>
          <div className={styles.head}>
            <p className={styles.intro}>FBA inventory by SKU, and orders shipped by Amazon.</p>
            <button className={styles.refresh} onClick={reload} disabled={loading}>
              Refresh
            </button>
          </div>

          <>
              <section className={styles.card}>
                <div className={styles.cardHead}>
                  <div>
                    <h3>Inventory</h3>
                    <span className={styles.cardSub}>Inventory List</span>
                  </div>
                  <ExportCsvButton
                    filename="inventory"
                    rows={inventory}
                    columns={[
                      { header: "No.", value: (i) => inventory.indexOf(i) + 1 },
                      { header: "SKU", value: (i) => i.sku },
                      { header: "Item Name", value: (i) => i.item_name ?? "" },
                      { header: "Country", value: (i) => i.country ?? "" },
                      { header: "Warehouse", value: (i) => i.warehouse_quantity ?? "" },
                      { header: "Fulfillable", value: (i) => i.fulfillable_quantity ?? "" },
                      { header: "Unsellable", value: (i) => i.unsellable_quantity ?? "" },
                      { header: "Reserved", value: (i) => i.reserved_quantity ?? "" },
                    ]}
                  />
                </div>
                {inventoryLoading ? (
                  <p className={styles.state}>Loading…</p>
                ) : inventoryError ? (
                  <p className={`${styles.state} ${styles.error}`}>{inventoryError}</p>
                ) : (
                  <DataTable
                    columns={inventoryColumns}
                    rows={inventory}
                    rowKey={(i) => i.sku}
                    showRowNumbers
                    filters={inventoryFilters}
                    searchPlaceholder="Search SKUs, items, or countries…"
                    emptyMessage="No inventory records match your search."
                  />
                )}
              </section>

              <section className={styles.card}>
                <div className={styles.cardHead}>
                  <div>
                    <h3>Shipments</h3>
                    <span className={styles.cardSub}>Orders shipments</span>
                  </div>
                  <ExportCsvButton
                    filename="shipments"
                    rows={filteredShipments}
                    columns={[
                      { header: "No.", value: (s) => filteredShipments.indexOf(s) + 1 },
                      { header: "SKU", value: (s) => s.sku },
                      { header: "Order ID", value: (s) => s.order_id ?? "" },
                      { header: "Product Name", value: (s) => s.product_name ?? "" },
                      { header: "Shipment Qty", value: (s) => s.shipment_qty ?? "" },
                      { header: "Tracking Number", value: (s) => s.tracking_number ?? "" },
                      { header: "Currency", value: (s) => s.currency ?? "" },
                      { header: "Purchase Date", value: (s) => s.purchase_date ?? "" },
                      { header: "Sales Channel", value: (s) => s.sales_channel ?? "" },
                    ]}
                  />
                </div>

                <div className={styles.dateBar}>
                  <div className={styles.dateGroup}>
                    <span className={styles.dateLabel}>Purchase date</span>
                    <div className={styles.dateRow}>
                      <input
                        type="date"
                        className={styles.dateInput}
                        value={fromDate}
                        max={toDate || undefined}
                        onChange={(e) => setFromDate(e.target.value)}
                        aria-label="Purchased from"
                      />
                      <span className={styles.dateTo}>to</span>
                      <input
                        type="date"
                        className={styles.dateInput}
                        value={toDate}
                        min={fromDate || undefined}
                        onChange={(e) => setToDate(e.target.value)}
                        aria-label="Purchased to"
                      />
                    </div>
                  </div>
                  <div className={styles.chips}>
                    {DATE_PRESETS.map((p) => {
                      const [from, to] = p.range();
                      const active = fromDate === from && toDate === to;
                      return (
                        <button
                          key={p.label}
                          type="button"
                          className={`${styles.chip} ${active ? styles.chipActive : ""}`}
                          aria-pressed={active}
                          onClick={() => {
                            setFromDate(from);
                            setToDate(to);
                          }}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                    {hasDateFilter && (
                      <button
                        type="button"
                        className={styles.clearBtn}
                        onClick={() => {
                          setFromDate("");
                          setToDate("");
                        }}
                      >
                        <X size={14} aria-hidden="true" />
                        Clear dates
                      </button>
                    )}
                  </div>
                </div>

                {shipmentsLoading ? (
                  <p className={styles.state}>Loading…</p>
                ) : shipmentsError ? (
                  <p className={`${styles.state} ${styles.error}`}>{shipmentsError}</p>
                ) : (
                  <DataTable
                    columns={shipmentColumns}
                    rows={filteredShipments}
                    rowKey={(s) => `${s.order_id}-${s.sku}-${s.tracking_number}`}
                    showRowNumbers
                    searchPlaceholder="Search SKUs, orders, products, or tracking numbers…"
                    emptyMessage={hasDateFilter ? "No shipments in this date range." : "No shipments match your search."}
                  />
                )}
              </section>
          </>
        </main>
      </div>
    </div>
  );
}
