import { useId, useState } from "react";
import type { CategorySlice } from "../types";
import styles from "./CategoryDonut.module.css";

const SIZE = 190;
const STROKE = 24;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;
const GAP = 3; // gap between segments, in units of circumference

const SERIES = [
  "var(--cat-1)",
  "var(--cat-2)",
  "var(--cat-3)",
  "var(--cat-4)",
  "var(--cat-5)",
  "var(--cat-6)",
];

function money(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

interface Props {
  data: CategorySlice[];
  title?: string;
  subtitle?: string;
  centerLabel?: string;
}

export default function CategoryDonut({
  data,
  title = "Sales by category",
  subtitle = "Last 30 days",
  centerLabel = "total revenue",
}: Props) {
  const titleId = useId();
  const [hovered, setHovered] = useState<number | null>(null);

  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;

  let offset = 0;
  const segments = data.map((d, i) => {
    const len = (d.value / total) * CIRC;
    const seg = {
      ...d,
      color: SERIES[i % SERIES.length],
      pct: (d.value / total) * 100,
      dash: `${Math.max(len - GAP, 0.001)} ${CIRC - Math.max(len - GAP, 0.001)}`,
      dashoffset: -offset,
    };
    offset += len;
    return seg;
  });

  const active = hovered != null ? segments[hovered] : null;

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h3 id={titleId}>{title}</h3>
        <span className={styles.sub}>{subtitle}</span>
      </div>

      <div className={styles.body}>
        <div className={styles.ring}>
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-labelledby={titleId}>
            <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
              {segments.map((s, i) => (
                <circle
                  key={s.category}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={R}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={hovered === i ? STROKE + 4 : STROKE}
                  strokeDasharray={s.dash}
                  strokeDashoffset={s.dashoffset}
                  opacity={hovered == null || hovered === i ? 1 : 0.35}
                  className={styles.segment}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                />
              ))}
            </g>
          </svg>
          <div className={styles.center}>
            <span className={styles.centerValue}>
              {active ? `${active.pct.toFixed(1)}%` : money(total)}
            </span>
            <span className={styles.centerLabel}>{active ? active.category : centerLabel}</span>
          </div>
        </div>

        <ul className={styles.legend}>
          {segments.map((s, i) => (
            <li
              key={s.category}
              className={hovered != null && hovered !== i ? styles.legendDim : ""}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <span className={styles.swatch} style={{ background: s.color }} />
              <span className={styles.legendName}>{s.category}</span>
              <span className={styles.legendValue}>
                {money(s.value)} <span className={styles.legendPct}>· {s.pct.toFixed(0)}%</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
