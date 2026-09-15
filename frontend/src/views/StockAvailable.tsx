import AppSidebar from "../components/AppSidebar";
import AppTopbar from "../components/AppTopbar";
import DataTable, { type DataTableColumn, type DataTableFilter } from "../components/DataTable";
import ExportCsvButton from "../components/ExportCsvButton";
import { useStock } from "../hooks/useStock";
import type { InventoryRow, ShipmentRow, ShipmentStatus, StockCountry, StockItem, StockStatus } from "../types";
import styles from "./StockAvailable.module.css";

const STATUS_LABEL: Record<StockStatus, string> = {
  ok: "In stock",
  low: "Low",
  out: "Out of stock",
};

const STATUS_FILTER_OPTIONS = Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }));

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

export default function StockAvailable() {
  const { data, lowItems, loading, error, reload } = useStock();

  const byItem = data?.byItem ?? [];
  const byCountry = data?.byCountry ?? [];
  const inventory = data?.inventory ?? [];
  const shipments = data?.shipments ?? [];
  const totalOnHand = byCountry.reduce((s, c) => s + c.available, 0);

  const itemColumns: DataTableColumn<StockItem>[] = [
    { key: "finish", header: "Item", accessor: (i) => i.finish },
    {
      key: "available",
      header: "Available",
      accessor: (i) => i.available,
      align: "right",
      className: styles.numCol,
    },
    {
      key: "inbound",
      header: "Inbound",
      accessor: (i) => i.inbound,
      align: "right",
      className: styles.numCol,
      render: (i) => (i.inbound ? num(i.inbound) : "—"),
    },
    {
      key: "reorderLevel",
      header: "Reorder level",
      accessor: (i) => i.reorderLevel,
      align: "right",
      className: styles.numCol,
    },
    {
      key: "status",
      header: "Status",
      accessor: (i) => i.status,
      render: (i) => <span className={`${styles.pill} ${styles[i.status]}`}>{STATUS_LABEL[i.status]}</span>,
    },
  ];

  const itemFilters: DataTableFilter<StockItem>[] = [
    { key: "status", label: "Status", accessor: (i) => i.status, options: STATUS_FILTER_OPTIONS },
  ];

  const countryColumns: DataTableColumn<StockCountry>[] = [
    { key: "country", header: "Country", accessor: (c) => c.country },
    { key: "warehouse", header: "Warehouse", accessor: (c) => c.warehouse, className: styles.muted },
    {
      key: "available",
      header: "Available",
      accessor: (c) => c.available,
      align: "right",
      className: styles.numCol,
      render: (c) =>
        c.available === 0 ? <span className={`${styles.pill} ${styles.out}`}>Out</span> : num(c.available),
    },
    {
      key: "share",
      header: "Share",
      accessor: (c) => (totalOnHand ? (c.available / totalOnHand) * 100 : 0),
      align: "right",
      className: styles.numCol,
      render: (c) => `${(totalOnHand ? (c.available / totalOnHand) * 100 : 0).toFixed(0)}%`,
    },
  ];

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
        <AppTopbar title="Stock available" />
        <main className={styles.content}>
          <div className={styles.head}>
            <p className={styles.intro}>
              On-hand inventory by item, by fulfilment country and warehouse, and inbound shipments.
            </p>
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
              {lowItems.length > 0 && (
                <div className={styles.alert} role="alert">
                  <span className={styles.alertIcon} aria-hidden="true">
                    !
                  </span>
                  <div>
                    <strong>
                      {lowItems.length} item{lowItems.length > 1 ? "s" : ""} need attention
                    </strong>
                    <p className={styles.alertBody}>
                      {lowItems
                        .map((i) => `${i.finish} (${i.status === "out" ? "out of stock" : `${i.available} left`})`)
                        .join(", ")}
                    </p>
                  </div>
                </div>
              )}

              <section className={styles.card}>
                <div className={styles.cardHead}>
                  <div>
                    <h3>Items</h3>
                    <span className={styles.cardSub}>
                      Flagged low at or below each item's reorder level
                    </span>
                  </div>
                  <ExportCsvButton
                    filename="stock-by-item"
                    rows={byItem}
                    columns={[
                      { header: "Item", value: (i) => i.finish },
                      { header: "Available", value: (i) => i.available },
                      { header: "Inbound", value: (i) => i.inbound },
                      { header: "Reorder level", value: (i) => i.reorderLevel },
                      { header: "Status", value: (i) => STATUS_LABEL[i.status] },
                    ]}
                  />
                </div>
                <DataTable
                  columns={itemColumns}
                  rows={byItem}
                  rowKey={(i) => i.finish}
                  filters={itemFilters}
                  rowClassName={(i) => (i.status !== "ok" ? styles.rowFlag : "")}
                  searchPlaceholder="Search items…"
                  emptyMessage="No items match your search."
                />
              </section>

              <section className={styles.card}>
                <div className={styles.cardHead}>
                  <div>
                    <h3>Stock by country</h3>
                    <span className={styles.cardSub}>
                      {num(totalOnHand)} units on hand across {byCountry.length} warehouses
                    </span>
                  </div>
                  <ExportCsvButton
                    filename="stock-by-country"
                    rows={byCountry}
                    columns={[
                      { header: "Country", value: (c) => c.country },
                      { header: "Warehouse", value: (c) => c.warehouse },
                      { header: "Available", value: (c) => c.available },
                    ]}
                  />
                </div>
                <DataTable
                  columns={countryColumns}
                  rows={byCountry}
                  rowKey={(c) => c.country}
                  searchPlaceholder="Search countries or warehouses…"
                  emptyMessage="No countries match your search."
                />
              </section>

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
