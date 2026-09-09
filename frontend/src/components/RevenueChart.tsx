import { useMemo, useState } from "react";
import type { RevenuePoint } from "../types";
import styles from "./RevenueChart.module.css";

interface RevenueChartProps {
  data: RevenuePoint[];
}

const WIDTH = 560;
const HEIGHT = 200;
const PADDING = 16;

function money(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

export default function RevenueChart({ data }: RevenueChartProps) {
  const [hover, setHover] = useState<number | null>(null);

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
          <h3>Revenue trend</h3>
          <span className={styles.chartSub}>Last {data.length} months</span>
        </div>
        <div className={styles.headline}>
          <span className={styles.headValue}>{money(latest)}</span>
          <span className={`${styles.headDelta} ${up ? styles.up : styles.down}`}>
            {up ? "▲" : "▼"} {Math.abs(momDelta).toFixed(1)}% MoM
          </span>
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
            <strong>{money(active.value)}</strong>
            <span>{active.month}</span>
          </div>
        )}

        <div className={styles.axisMax}>{money(max)}</div>
        <div className={styles.axisMin}>{money(min)}</div>
      </div>

      <div className={styles.chartLabels}>
        {data.map((d) => (
          <span key={d.month}>{d.month}</span>
        ))}
      </div>
    </div>
  );
}
