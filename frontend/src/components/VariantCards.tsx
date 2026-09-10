import { useState } from "react";
import type { SalesPeriod, VariantRow } from "../types";
import ExportCsvButton from "./ExportCsvButton";
import styles from "./VariantCards.module.css";

function money(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

function stockLabel(stock: number): { text: string; tone: "ok" | "low" | "out" } {
  if (stock <= 0) return { text: "Out of stock", tone: "out" };
  if (stock <= 25) return { text: `Low · ${stock} left`, tone: "low" };
  return { text: `${stock.toLocaleString()} in stock`, tone: "ok" };
}

const PERIODS: { key: SalesPeriod; label: string; range: string }[] = [
  { key: "daily", label: "Daily", range: "Last 24 hours" },
  { key: "weekly", label: "Weekly", range: "Last 7 days" },
  { key: "monthly", label: "Monthly", range: "Last 30 days" },
  { key: "yearly", label: "Yearly", range: "Last 12 months" },
];

interface Props {
  variantsByPeriod: Record<SalesPeriod, VariantRow[]>;
}

export default function VariantCards({ variantsByPeriod }: Props) {
  const [period, setPeriod] = useState<SalesPeriod>("monthly");
  const meta = PERIODS.find((p) => p.key === period) ?? PERIODS[2];
  const variants = variantsByPeriod[period] ?? [];
  const totalUnits = variants.reduce((s, v) => s + v.units, 0) || 1;

  return (
    <section>
      <div className={styles.sectionHead}>
        <h3>Sales by finish</h3>
        <span className={styles.sub}>{meta.range}</span>
        <span className={styles.spacer} />
        <select
          className={styles.periodSelect}
          aria-label="Reporting period"
          value={period}
          onChange={(e) => setPeriod(e.target.value as SalesPeriod)}
        >
          {PERIODS.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
        <ExportCsvButton
          filename={`sales-by-finish-${period}`}
          rows={variants}
          columns={[
            { header: "Finish", value: (v) => v.finish },
            { header: "Units sold", value: (v) => v.units },
            { header: "Revenue", value: (v) => v.revenue },
            { header: "Stock", value: (v) => v.stock },
            { header: "Rating", value: (v) => v.rating },
          ]}
        />
      </div>

      <div className={styles.grid}>
        {variants.map((v) => {
          const stock = stockLabel(v.stock);
          const share = (v.units / totalUnits) * 100;
          return (
            <article key={v.finish} className={styles.card}>
              <div className={styles.head}>
                <span className={styles.finish}>{v.finish}</span>
                <span className={styles.rating} title={`${v.rating} out of 5`}>
                  ★ {v.rating.toFixed(1)}
                </span>
              </div>

              <div className={styles.figures}>
                <div>
                  <span className={styles.figLabel}>Units sold</span>
                  <span className={styles.figValue}>{v.units.toLocaleString()}</span>
                </div>
                <div>
                  <span className={styles.figLabel}>Revenue</span>
                  <span className={styles.figValue}>{money(v.revenue)}</span>
                </div>
              </div>

              <div className={styles.shareRow}>
                <div className={styles.bar}>
                  <span style={{ width: `${share}%` }} />
                </div>
                <span className={styles.sharePct}>{share.toFixed(0)}% of units</span>
              </div>

              <span className={`${styles.stock} ${styles[stock.tone]}`}>{stock.text}</span>
            </article>
          );
        })}
      </div>
    </section>
  );
}
