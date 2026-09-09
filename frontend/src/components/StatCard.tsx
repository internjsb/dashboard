import styles from "./StatCard.module.css";

interface StatCardProps {
  label: string;
  value: number;
  delta: number;
  unit?: "count" | "currency" | "percent";
  featured?: boolean;
}

export default function StatCard({ label, value, delta, unit = "count", featured = false }: StatCardProps) {
  let formattedValue: string;
  if (unit === "currency") {
    formattedValue = `$${value.toLocaleString()}`;
  } else if (unit === "percent") {
    formattedValue = `${value}%`;
  } else {
    formattedValue = value.toLocaleString();
  }

  return (
    <div className={`${styles.statCard} ${featured ? styles.featured : ""}`}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{formattedValue}</span>
      <span className={`${styles.delta} ${delta >= 0 ? styles.up : styles.down}`}>
        {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}%
      </span>
    </div>
  );
}
