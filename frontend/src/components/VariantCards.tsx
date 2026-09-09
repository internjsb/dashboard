import type { VariantRow } from "../types";
import styles from "./VariantCards.module.css";

function money(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

function stockLabel(stock: number): { text: string; tone: "ok" | "low" | "out" } {
  if (stock <= 0) return { text: "Out of stock", tone: "out" };
  if (stock <= 25) return { text: `Low · ${stock} left`, tone: "low" };
  return { text: `${stock.toLocaleString()} in stock`, tone: "ok" };
}

interface Props {
  variants: VariantRow[];
}

export default function VariantCards({ variants }: Props) {
  const totalUnits = variants.reduce((s, v) => s + v.units, 0) || 1;

  return (
    <section>
      <div className={styles.sectionHead}>
        <h3>Sales by finish</h3>
        <span className={styles.sub}>Last 30 days</span>
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
