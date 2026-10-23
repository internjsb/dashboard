import AppSidebar from "../components/AppSidebar";
import AppTopbar from "../components/AppTopbar";
import { useEffect, useState } from "react";
import DataTable, { type DataTableColumn, type DataTableFilter } from "../components/DataTable";
import ExportCsvButton from "../components/ExportCsvButton";
import { inMarketplace, useMarketplace } from "../hooks/useMarketplace";
import { useStock } from "../hooks/useStock";
// import type { StockCountry } from "../types";
import styles from "./StockAvailable.module.css";
import api from "../api/client";

export interface StockItem {
  sku: string;
  product_item_code: string;
  item_description: string;
  available: number;
  inbound: number;
  total_units: number;
  status: string | null;
  marketplace_id: string | null; // not shown; used by the top-bar marketplace filter
}

export interface StockCountry {
  sku: string;
  dtiItemCode: string;
  country: string;
  warehouse: string;
  available: number;
}

// How many flagged items the alert banner shows before "+N more".
const ALERT_NAMES = 8;

// One chip in the alert banner: an item and all its flagged SKUs together.
interface FlaggedItem {
  name: string;
  available: number;
  skus: number;
}

// Group flagged SKUs by item (one item can have several SKUs), out of stock first.
function groupFlagged(items: StockItem[]): FlaggedItem[] {
  const byName = new Map<string, FlaggedItem>();
  for (const i of items) {
    const name = i.item_description || i.sku;
    const g = byName.get(name) ?? { name, available: 0, skus: 0 };
    g.available += i.available;
    g.skus += 1;
    byName.set(name, g);
  }
  return [...byName.values()].sort((a, b) => a.available - b.available || a.name.localeCompare(b.name));
}

function num(n: number): string {
  return n.toLocaleString();
}

function optionsOf(values: (string | null)[]) {
  return Array.from(new Set(values.filter((v): v is string => !!v)))
    .sort()
    .map((v) => ({ value: v, label: v }));
}

export default function StockAvailable() {
  const { rows, loading, error, reload } = useStock();
  const {code} = useMarketplace();

  const [byCountry, setByCountry] = useState<StockCountry[]>([]);
  useEffect(() => {
    let cancelled = false;
    api
      .get<{ byCountry: StockCountry[] }>("/dashboard/stock-available")
      .then(({ data }) => {
        if (!cancelled) setByCountry(data.byCountry);
      })
      .catch((err) => console.error(err));
    return () => {
      cancelled = true;
    };
  }, []);

  const totalOnHand = byCountry.reduce((s, c) => s + c.available, 0);
 
 const items = rows.filter((i) => inMarketplace(code, i.marketplace_id));
  const lowItems = items.filter((i) => !!i.status);
  const flagged = groupFlagged(lowItems);
  const outCount = flagged.filter((g) => g.available <= 0).length;
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const shownFlagged = showAllAlerts ? flagged : flagged.slice(0, ALERT_NAMES);


   const qtyCol = (key: "available" | "inbound" | "total_units", header: string): DataTableColumn<StockItem> => ({
    key,
    header,
    accessor: (i) => i[key],
    align: "right",
    className: styles.numCol,
    render: (i) => num(i[key]),
  });

  const columns: DataTableColumn<StockItem>[] = [
    { key: "sku", header: "SKU", accessor: (i) => i.sku },
    { key: "product_item_code", header: "Product Item Code", accessor: (i) => i.product_item_code },
    { key: "item_description", header: "item_description", accessor: (i) => i.item_description },
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
      key: "total_units",
      header: "Total Units",
      accessor: (i) => i.total_units,
      align: "right",
      className: styles.numCol,
    },
    {
      key: "status",
      header: "Status",
      accessor: (i) => i.status ?? "",
      render: (i) => (i.status ? <span className={`${styles.pill} ${styles.low}`}>{i.status}</span> : ""),
    },
  ];

    const countryColumns: DataTableColumn<StockCountry>[] = [
    { key: "sku", header: "SKU", accessor: (c) => c.sku },
    { key: "dtiItemCode", header: "DTI Item Code", accessor: (c) => c.dtiItemCode },
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

  const filters: DataTableFilter<StockItem>[] = [
        { key: "status", label: "Status", accessor: (i) => i.status ?? "", options: optionsOf(items.map((i) => i.status)) },
    {
      key: "product_item_code",
      label: "Product Item Code",
      accessor: (i) => i.product_item_code ?? "",
      options: optionsOf(items.map((i) => i.product_item_code)),
    },
  ];

  const countryFilters: DataTableFilter<StockCountry>[] = [
    {
      key: "dtiItemCode",
      label: "DTI Item Code",
      accessor: (c) => c.dtiItemCode,
      options: Array.from(new Set(byCountry.map((c) => c.dtiItemCode)))
        .sort()
        .map((code) => ({ value: code, label: code })),
    },
  ];

  return (
    <div className="app-shell">
      <AppSidebar />
      <div className="app-content">
        <AppTopbar title="Available Stock" />
        <main className={styles.content}>
          <div className={styles.head}>
            <p className={styles.intro}>Stock available by item, by fulfilment country and warehouse.</p>
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
              {flagged.length > 0 && (
                <div className={styles.alert} role="alert">
                  <span className={styles.alertIcon} aria-hidden="true">
                    !
                  </span>
                  <div className={styles.alertMain}>
                    <div className={styles.alertHead}>
                      <strong>
                        {flagged.length} item{flagged.length > 1 ? "s" : ""} need attention
                      </strong>
                      <span className={styles.alertSummary}>
                        {outCount} out of stock · {flagged.length - outCount} running low
                      </span>
                    </div>
                    <ul className={styles.chips}>
                      {shownFlagged.map((g) => (
                        <li key={g.name} className={`${styles.chip} ${g.available <= 0 ? styles.chipOut : styles.chipLow}`}>
                          <span className={styles.chipName}>{g.name}</span>
                          <span className={styles.chipQty}>{g.available <= 0 ? "Out" : `${num(g.available)} left`}</span>
                          {g.skus > 1 && (
                            <span className={styles.chipSkus} title={`${g.skus} SKUs`}>
                              ×{g.skus}
                            </span>
                          )}
                        </li>
                      ))}
                      {flagged.length > ALERT_NAMES && (
                        <li>
                          <button className={styles.chipMore} onClick={() => setShowAllAlerts((s) => !s)}>
                            {showAllAlerts ? "Show less" : `+${flagged.length - ALERT_NAMES} more`}
                          </button>
                        </li>
                      )}
                    </ul>
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
                    filename="stock-available"
                    rows={items}
                    columns={[
                      { header: "SKU", value: (i) => i.sku },
                      { header: "Product Item Code", value: (i) => i.product_item_code },
                      { header: "item_description", value: (i) => i.item_description },
                      { header: "Available", value: (i) => i.available },
                      { header: "Inbound", value: (i) => i.inbound },
                      { header: "Total Units", value: (i) => i.total_units },
                      { header: "Status", value: (i) => i.status ?? "" },
                    ]}
                  />
                </div>
                <DataTable
                  columns={columns}
                  rows={items}
                  rowKey={(i) => `${i.sku}-${i.marketplace_id ?? ""}`}
                  filters={filters}
                  showRowNumbers
                  rowClassName={(i) => (i.status ? styles.rowFlag : "")}
                  searchPlaceholder="Search SKUs or items…"
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
                      { header: "SKU", value: (c) => c.sku },
                      { header: "DTI Item Code", value: (c) => c.dtiItemCode },
                      { header: "Country", value: (c) => c.country },
                      { header: "Warehouse", value: (c) => c.warehouse },
                      { header: "Available", value: (c) => c.available },
                    ]}
                  />
                </div>
                <DataTable
                  columns={countryColumns}
                  rows={byCountry}
                  rowKey={(c) => `${c.sku}-${c.warehouse}`}
                  filters={countryFilters}
                  searchPlaceholder="Search countries or warehouses…"
                  emptyMessage="No countries match your search."
                />
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
