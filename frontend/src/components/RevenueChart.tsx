import { useMemo, useState, type ReactNode } from "react";
import type { RevenuePoint } from "../types";
import styles from "./RevenueChart.module.css";

interface RevenueChartProps {
  data: RevenuePoint[];
  title?: string;
  subtitle?: string;
  deltaSuffix?: string;
  format?: "currency" | "number";
  action?: ReactNode;
}

const WIDTH = 560;
const HEIGHT = 200;
const PADDING = 16;

function money(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

function count(n: number): string {
  return Math.round(n).toLocaleString();
}

export default function RevenueChart({
  data,
  title = "Revenue trend",
  subtitle,
  deltaSuffix = "MoM",
  format = "currency",
  action,
}: RevenueChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  const fmt = format === "currency" ? money : count;

  const { plotted, max, min } = useMemo(() => {
    const values = data.map((d) => d.value);
    const mx = Math.max(...values, 0);
    const mn = Math.min(...values, 0);
    const range = mx - mn || 1;
    const step = data.length > 1 ? (WIDTH - PADDING * 2) / (data.length - 1) : 0;
    return {
      max: mx,
      min: mn,
      plotted: data.map((d, i) => ({
        x: PADDING + i * step,
        y: HEIGHT - PADDING - ((d.value - mn) / range) * (HEIGHT - PADDING * 2),
        ...d,
      })),
    };
  }, [data]);

  // Dense series (e.g. 30 daily points) would overflow a label row sized for
  // ~12 months, so thin them out past that point; short series are unaffected.
  const labelStep = data.length > 12 ? Math.ceil(data.length / 8) : 1;

  const linePoints = plotted.map((p) => `${p.x},${p.y}`).join(" ");
  const areaPoints =
    plotted.length > 0
      ? `${plotted[0].x},${HEIGHT} ${linePoints} ${plotted[plotted.length - 1].x},${HEIGHT}`
      : "";

  const latest = data[data.length - 1]?.value ?? 0;
  const prev = data[data.length - 2]?.value ?? latest;
  const momDelta = prev ? ((latest - prev) / prev) * 100 : 0;
  const up = momDelta >= 0;

  const active = hover != null ? plotted[hover] : null;

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <div>
          <h3>{title}</h3>
          <span className={styles.chartSub}>{subtitle ?? `Last ${data.length} months`}</span>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.headline}>
            <span className={styles.headValue}>{fmt(latest)}</span>
            <span className={`${styles.headDelta} ${up ? styles.up : styles.down}`}>
              {up ? "▲" : "▼"} {Math.abs(momDelta).toFixed(1)}% {deltaSuffix}
            </span>
          </div>
          {action}
        </div>
      </div>

      <div className={styles.plot}>
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className={styles.chartSvg} preserveAspectRatio="none">
          {[0.25, 0.5, 0.75].map((f) => (
            <line
              key={f}
              x1={PADDING}
              x2={WIDTH - PADDING}
              y1={PADDING + f * (HEIGHT - PADDING * 2)}
              y2={PADDING + f * (HEIGHT - PADDING * 2)}
              className={styles.grid}
            />
          ))}
          <polyline points={areaPoints} className={styles.area} />
          <polyline points={linePoints} className={styles.line} />
          {active && <line x1={active.x} x2={active.x} y1={PADDING} y2={HEIGHT - PADDING} className={styles.guide} />}
          {plotted.map((p, i) => (
            <circle key={p.month} cx={p.x} cy={p.y} r={hover === i ? 5 : 3.5} className={styles.dot} />
          ))}
          {/* invisible hit areas */}
          {plotted.map((p, i) => (
            <rect
              key={`hit-${p.month}`}
              x={p.x - WIDTH / data.length / 2}
              y={0}
              width={WIDTH / data.length}
              height={HEIGHT}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </svg>

        {active && (
          <div
            className={styles.tooltip}
            style={{ left: `${(active.x / WIDTH) * 100}%`, top: `${(active.y / HEIGHT) * 100}%` }}
          >
            <strong>{fmt(active.value)}</strong>
            <span>{active.month}</span>
          </div>
        )}

        <div className={styles.axisMax}>{fmt(max)}</div>
        <div className={styles.axisMin}>{fmt(min)}</div>
      </div>

      <div className={styles.chartLabels}>
        {data.map((d, i) => (
          <span key={d.month}>
            {i % labelStep === 0 || i === data.length - 1 ? d.month : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
