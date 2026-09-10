import { useState } from "react";
import CategoryDonut from "./CategoryDonut";
import type { SalesPeriod, VariantRow } from "../types";
import styles from "./SalesByFinishDonut.module.css";

const PERIODS: { key: SalesPeriod; label: string; range: string }[] = [
  { key: "daily", label: "Daily", range: "last 24 hours" },
  { key: "weekly", label: "Weekly", range: "last 7 days" },
  { key: "monthly", label: "Monthly", range: "last 30 days" },
  { key: "yearly", label: "Yearly", range: "last 12 months" },
];

interface Props {
  variantsByPeriod: Record<SalesPeriod, VariantRow[]>;
}

export default function SalesByFinishDonut({ variantsByPeriod }: Props) {
  const [period, setPeriod] = useState<SalesPeriod>("monthly");
  const meta = PERIODS.find((p) => p.key === period) ?? PERIODS[2];
  const rows = variantsByPeriod[period] ?? [];

  return (
    <CategoryDonut
      data={rows.map((v) => ({ category: v.finish, value: v.revenue }))}
      title="Sales by finish"
      subtitle={`Revenue share · ${meta.range}`}
      action={
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
      }
    />
  );
}
