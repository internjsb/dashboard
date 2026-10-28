import { useEffect, useState } from "react";
import AppSidebar from "../components/AppSidebar";
import AppTopbar from "../components/AppTopbar";
import DataTable, { type DataTableColumn, type DataTableFilter } from "../components/DataTable";
import ExportCsvButton from "../components/ExportCsvButton";
import api from "../api/client";
import type {
  ReportStatus,
  TaxStatus,
  TransactionRow,
  TransactionStatus,
  TransactionType,
  FinanceReportRow,
} from "../types";
import styles from "./Finance.module.css";
import { inMarketplace, useMarketplace } from "../hooks/useMarketplace";


export interface FinanceData {
  transactions: TransactionRow[];
  taxes: TaxRow[];
  reports: FinanceReportRow[];
}


export interface TaxRow {
  id: string;
  sku: string;
  dtiItemCode: string;
  sale_channel: string;
  item_tax: number;
  sold_qty: number;
  item_price: number;
  order_id : string;
  marketplace_id : string;
}


const EMPTY: FinanceData = { transactions: [], taxes: [], reports: [] };

const TXN_TYPE_LABEL: Record<TransactionType, string> = {
  sale: "Sale",
  refund: "Refund",
  payout: "Payout",
  fee: "Fee",
  advertising: "Advertising",
};
const TXN_TYPE_OPTIONS = Object.entries(TXN_TYPE_LABEL).map(([value, label]) => ({ value, label }));

const TXN_STATUS_LABEL: Record<TransactionStatus, string> = { completed: "Completed", pending: "Pending" };
const TXN_STATUS_OPTIONS = Object.entries(TXN_STATUS_LABEL).map(([value, label]) => ({ value, label }));

const REPORT_STATUS_LABEL: Record<ReportStatus, string> = { final: "Final", draft: "Draft" };
const REPORT_STATUS_OPTIONS = Object.entries(REPORT_STATUS_LABEL).map(([value, label]) => ({ value, label }));

function money(n: number): string {
  const abs = `$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return n < 0 ? `-${abs}` : abs;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function Finance() {
  const [data, setData] = useState<FinanceData>(EMPTY);
  const [taxes, setTaxes ] = useState<TaxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const {code} = useMarketplace(); 

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [ finance, tax ] = await Promise.all([
        api.get<FinanceData>("/dashboard/finance"),
        api.get<{ rows: TaxRow[]}>("/health/tax", { timeout: 30000 }),
      ]);
      setData(finance.data);
      setTaxes(
        tax.data.rows.map((r,i) => ({
          ...r,
          id: `${r.order_id ?? ""}-${r.sku}-${i}`,
          item_tax : Number(r.item_tax) || 0,
          sold_qty : Number(r.sold_qty) || 0,
          item_price: Number(r.item_price) || 0,
        })),
      );
   
    } catch (err) {
      setError("Couldn't load finance data. Is the backend running?");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const taxRows = taxes.filter((t)=> inMarketplace(code, t.marketplace_id));
  const totalTax = taxRows.reduce((sum, t) => sum + t.item_tax, 0);

  useEffect(() => {
    load();
  }, []);

  const transactionColumns: DataTableColumn<TransactionRow>[] = [
    { key: "sku", header: "SKU", accessor: (t) => t.sku, render: (t) => t.sku || "—", className: styles.muted },
    {
      key: "dtiItemCode",
      header: "Product Item Code",
      accessor: (t) => t.dtiItemCode,
      render: (t) => t.dtiItemCode || "—",
      className: styles.muted,
    },
    { key: "date", header: "Date", accessor: (t) => t.date, render: (t) => formatDate(t.date) },
    {
      key: "type",
      header: "Type",
      accessor: (t) => t.type,
      render: (t) => <span className={styles.pill}>{TXN_TYPE_LABEL[t.type]}</span>,
    },
    { key: "description", header: "Description", accessor: (t) => t.description },
    {
      key: "amount",
      header: "Amount",
      accessor: (t) => t.amount,
      align: "right",
      className: styles.numCol,
      render: (t) => <span className={t.amount < 0 ? styles.amountNegative : styles.amountPositive}>{money(t.amount)}</span>,
    },
    {
      key: "status",
      header: "Status",
      accessor: (t) => t.status,
      render: (t) => (
        <span className={`${styles.pill} ${styles[t.status === "completed" ? "ok" : "low"]}`}>
          {TXN_STATUS_LABEL[t.status]}
        </span>
      ),
    },
  ];

  const transactionFilters: DataTableFilter<TransactionRow>[] = [
    { key: "type", label: "Type", accessor: (t) => t.type, options: TXN_TYPE_OPTIONS },
    { key: "status", label: "Status", accessor: (t) => t.status, options: TXN_STATUS_OPTIONS },
    {
      key: "dtiItemCode",
      label: "Product Item Code",
      accessor: (t) => t.dtiItemCode,
      options: Array.from(new Set(data.transactions.map((t) => t.dtiItemCode)))
        .sort()
        .map((code) => ({ value: code, label: code })),
    },
  ];

  const taxColumns: DataTableColumn<TaxRow>[] = [
    { key: "sku", header: "SKU", accessor: (t) => t.sku, className: styles.muted },
    {
      key: "dtiItemCode",
      header: "Product Item Code",
      accessor: (t) => t.dtiItemCode,
      render: (t) => t.dtiItemCode || "—",
      className: styles.muted,
    },
    { key: "sale_channel", header: "Sale Channel", accessor: (t) => t.sale_channel },
    { key: "Item Tax", header: "Item Tax", accessor: (t) => t.item_tax, className: styles.muted },
    {
      key: "Sold Qty",
      header: "Sold Qty",
      accessor: (t) => t.sold_qty,
      align: "right",
      className: styles.numCol,
      render: (t) => money(t.sold_qty),
    },
    {
      key: "Item Price",
      header: "Item Price",
      accessor: (t) => t.item_price,
      align: "right",
      className: styles.numCol,
      render: (t) => money(t.item_price),
    },
  ];

  const optionsOf = (values: (string | null)[]) =>
    Array.from(new Set(values.filter((v): v is string => !!v)))
    .sort()
    .map((v) => ({ value: v, label: v}));



  const reportColumns: DataTableColumn<FinanceReportRow>[] = [
    { key: "sku", header: "SKU", accessor: (r) => r.sku, render: (r) => r.sku || "—", className: styles.muted },
    {
      key: "dtiItemCode",
      header: "DTI Item Code",
      accessor: (r) => r.dtiItemCode,
      render: (r) => r.dtiItemCode || "—",
      className: styles.muted,
    },
    { key: "name", header: "Report", accessor: (r) => r.name },
    { key: "period", header: "Period", accessor: (r) => r.period, className: styles.muted },
    { key: "type", header: "Type", accessor: (r) => r.type },
    {
      key: "generatedOn",
      header: "Generated on",
      accessor: (r) => r.generatedOn,
      render: (r) => formatDate(r.generatedOn),
    },
    {
      key: "status",
      header: "Status",
      accessor: (r) => r.status,
      render: (r) => (
        <span className={`${styles.pill} ${styles[r.status === "final" ? "ok" : "low"]}`}>
          {REPORT_STATUS_LABEL[r.status]}
        </span>
      ),
    },
  ];

  const reportFilters: DataTableFilter<FinanceReportRow>[] = [
    { key: "status", label: "Status", accessor: (r) => r.status, options: REPORT_STATUS_OPTIONS },
    {
      key: "dtiItemCode",
      label: "Product Item Code",
      accessor: (r) => r.dtiItemCode,
      options: Array.from(new Set(data.reports.map((r) => r.dtiItemCode)))
        .sort()
        .map((code) => ({ value: code, label: code })),
    },
  ];

    const taxFilters: DataTableFilter<TaxRow>[] = [
    {
      key: "dtiItemCode",
      label: "Product Item Code",
      accessor: (t) => t.dtiItemCode ?? "",
      options: optionsOf(taxRows.map((t) => t.dtiItemCode)),
    },
    {
      key: "sale_channel",
      label: "Sales Channel",
      accessor: (t) => t.sale_channel ?? "",
      options: optionsOf(taxRows.map((t) => t.sale_channel)),
    },
  ];


  return (
    <div className="app-shell">
      <AppSidebar />
      <div className="app-content">
        <AppTopbar title="Finance" />
        <main className={styles.content}>
          <div className={styles.head}>
            <p className={styles.intro}>Transactions, tax filings, and generated finance reports.</p>
            <button className={styles.refresh} onClick={load} disabled={loading}>
              Refresh
            </button>
          </div>

          {loading ? (
            <p className={styles.state}>Loading…</p>
          ) : error ? (
            <p className={`${styles.state} ${styles.error}`}>{error}</p>
          ) : (
            <>
              {/* <section className={styles.card}> */}
                {/* <div className={styles.cardHead}> */}
                  {/* <div> */}
                    {/* <h3>Transactions</h3> */}
                    {/* <span className={styles.cardSub}>Sales, refunds, payouts, fees, and ad spend</span> */}
                  {/* </div> */}
                  {/* <ExportCsvButton
                    filename="transactions"
                    rows={data.transactions}
                    columns={[
                      { header: "SKU", value: (t) => t.sku },
                      { header: "DTI Item Code", value: (t) => t.dtiItemCode },
                      { header: "Date", value: (t) => t.date },
                      { header: "Type", value: (t) => TXN_TYPE_LABEL[t.type] },
                      { header: "Description", value: (t) => t.description },
                      { header: "Amount", value: (t) => t.amount.toFixed(2) },
                      { header: "Status", value: (t) => TXN_STATUS_LABEL[t.status] },
                    ]}
                  /> */}
                {/* </div> */}
                {/* <DataTable
                  columns={transactionColumns}
                  rows={data.transactions}
                  rowKey={(t) => t.id}
                  filters={transactionFilters}
                  searchPlaceholder="Search transactions…"
                  emptyMessage="No transactions match your search."
                /> */}
              {/* </section> */}

              <section className={styles.card}>
                <div className={styles.cardHead}>
                  <div>
                    <h3>Taxes</h3>
                    <span className={styles.cardSub}>Tax collected by jurisdiction and filing period</span>
                  </div>
                  <ExportCsvButton
                    filename="taxes"
                    rows={taxRows}
                    columns={[
                      { header: "SKU", value: (t) => t.sku },
                      { header: "Product Item Code", value: (t) => t.dtiItemCode },
                      { header: "sale_channel", value: (t) => t.sale_channel },
                      { header: "Item Tax", value: (t) => t.item_tax },
                      { header: "Sold Qty", value: (t) => t.sold_qty },
                      { header: "Item Price", value: (t) => t.item_price },
                    
                    ]}
                  />
                </div>
                <DataTable
                  columns={taxColumns}
                  rows={taxRows}
                  rowKey={(t) => t.id}
                  filters={taxFilters}
                  searchPlaceholder="Search taxes…"
                  emptyMessage="No tax records match your search."
                />
              </section>

              {/* <section className={styles.card}>
                <div className={styles.cardHead}>
                  <div>
                    <h3>Finance reports</h3>
                    <span className={styles.cardSub}>Generated statements and cash-flow reports</span>
                  </div>
                  <ExportCsvButton
                    filename="finance-reports"
                    rows={data.reports}
                    columns={[
                      { header: "SKU", value: (r) => r.sku },
                      { header: "Product Item Code", value: (r) => r.dtiItemCode },
                      { header: "Report", value: (r) => r.name },
                      { header: "Period", value: (r) => r.period },
                      { header: "Type", value: (r) => r.type },
                      { header: "Generated on", value: (r) => r.generatedOn },
                      { header: "Status", value: (r) => REPORT_STATUS_LABEL[r.status] },
                    ]}
                  />
                </div>
                <DataTable
                  columns={reportColumns}
                  rows={data.reports}
                  rowKey={(r) => r.id}
                  filters={reportFilters}
                  searchPlaceholder="Search reports…"
                  emptyMessage="No reports match your search."
                />
              </section> */}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
