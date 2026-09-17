import AppSidebar from "../components/AppSidebar";
import AppTopbar from "../components/AppTopbar";
import DataTable, { type DataTableColumn, type DataTableFilter } from "../components/DataTable";
import ExportCsvButton from "../components/ExportCsvButton";
import { useStock } from "../hooks/useStock";
import type { InventoryRow, ShipmentRow, ShipmentStatus } from "../types";
import styles from "./Inventory.module.css";

const SHIPMENT_STATUS_LABEL: Record<ShipmentStatus, string> = {
  in_transit: "In transit",
  customs: "Customs",
  delayed: "Delayed",
  arrived: "Arrived",
};

const SHIPMENT_STATUS_FILTER_OPTIONS = Object.entries(SHIPMENT_STATUS_LABEL).map(([value, label]) => ({
  value,
  label,
}));

function formatEta(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function num(n: number): string {
  return n.toLocaleString();
}

export default function Inventory() {
  const { data, loading, error, reload } = useStock();

  const inventory = data?.inventory ?? [];
  const shipments = data?.shipments ?? [];

  const inventoryColumns: DataTableColumn<InventoryRow>[] = [
    { key: "finish", header: "Item", accessor: (i) => i.finish },
    { key: "warehouse", header: "Warehouse", accessor: (i) => i.warehouse, className: styles.muted },
    { key: "country", header: "Country", accessor: (i) => i.country },
    {
      key: "onHand",
      header: "On hand",
      accessor: (i) => i.onHand,
      align: "right",
      className: styles.numCol,
      render: (i) => num(i.onHand),
    },
    {
      key: "reserved",
      header: "Reserved",
      accessor: (i) => i.reserved,
      align: "right",
      className: styles.numCol,
      render: (i) => num(i.reserved),
    },
    {
      key: "available",
      header: "Available",
      accessor: (i) => i.available,
      align: "right",
      className: styles.numCol,
      render: (i) => num(i.available),
    },
  ];

  const shipmentColumns: DataTableColumn<ShipmentRow>[] = [
    { key: "id", header: "Shipment", accessor: (s) => s.id },
    { key: "finish", header: "Item", accessor: (s) => s.finish },
    {
      key: "quantity",
      header: "Qty",
      accessor: (s) => s.quantity,
      align: "right",
      className: styles.numCol,
      render: (s) => num(s.quantity),
    },
    { key: "origin", header: "Origin", accessor: (s) => s.origin, className: styles.muted },
    { key: "destination", header: "Destination", accessor: (s) => s.destination, className: styles.muted },
    { key: "carrier", header: "Carrier", accessor: (s) => s.carrier },
    {
      key: "eta",
      header: "ETA",
      accessor: (s) => s.eta,
      render: (s) => formatEta(s.eta),
    },
    {
      key: "status",
      header: "Status",
      accessor: (s) => s.status,
      render: (s) => (
        <span className={`${styles.pill} ${styles[s.status === "delayed" ? "out" : s.status === "arrived" ? "ok" : "low"]}`}>
          {SHIPMENT_STATUS_LABEL[s.status]}
        </span>
      ),
    },
  ];

  const shipmentFilters: DataTableFilter<ShipmentRow>[] = [
    { key: "status", label: "Status", accessor: (s) => s.status, options: SHIPMENT_STATUS_FILTER_OPTIONS },
  ];

  return (
    <div className="app-shell">
      <AppSidebar />
      <div className="app-content">
        <AppTopbar title="Inventory" />
        <main className={styles.content}>
          <div className={styles.head}>
            <p className={styles.intro}>On-hand inventory by item and warehouse, and inbound shipments.</p>
            <button className={styles.refresh} onClick={reload} disabled={loading}>
              Refresh
            </button>
          </div>

          {loading ? (
            <p className={styles.state}>Loading…</p>
          ) : error ? (
            <p className={`${styles.state} ${styles.error}`}>{error}</p>
          ) : (
            <>
              <section className={styles.card}>
                <div className={styles.cardHead}>
                  <div>
                    <h3>Inventory</h3>
                    <span className={styles.cardSub}>On-hand stock by item and warehouse</span>
                  </div>
                  <ExportCsvButton
                    filename="inventory"
                    rows={inventory}
                    columns={[
                      { header: "Item", value: (i) => i.finish },
                      { header: "Warehouse", value: (i) => i.warehouse },
                      { header: "Country", value: (i) => i.country },
                      { header: "On hand", value: (i) => i.onHand },
                      { header: "Reserved", value: (i) => i.reserved },
                      { header: "Available", value: (i) => i.available },
                    ]}
                  />
                </div>
                <DataTable
                  columns={inventoryColumns}
                  rows={inventory}
                  rowKey={(i) => `${i.finish}-${i.warehouse}`}
                  searchPlaceholder="Search items, warehouses, or countries…"
                  emptyMessage="No inventory records match your search."
                />
              </section>

              <section className={styles.card}>
                <div className={styles.cardHead}>
                  <div>
                    <h3>Shipments</h3>
                    <span className={styles.cardSub}>Inbound replenishment on the way</span>
                  </div>
                  <ExportCsvButton
                    filename="shipments"
                    rows={shipments}
                    columns={[
                      { header: "Shipment", value: (s) => s.id },
                      { header: "Item", value: (s) => s.finish },
                      { header: "Qty", value: (s) => s.quantity },
                      { header: "Origin", value: (s) => s.origin },
                      { header: "Destination", value: (s) => s.destination },
                      { header: "Carrier", value: (s) => s.carrier },
                      { header: "ETA", value: (s) => s.eta },
                      { header: "Status", value: (s) => SHIPMENT_STATUS_LABEL[s.status] },
                    ]}
                  />
                </div>
                <DataTable
                  columns={shipmentColumns}
                  rows={shipments}
                  rowKey={(s) => s.id}
                  filters={shipmentFilters}
                  rowClassName={(s) => (s.status === "delayed" ? styles.rowFlag : "")}
                  searchPlaceholder="Search shipments, items, or carriers…"
                  emptyMessage="No shipments match your search."
                />
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
