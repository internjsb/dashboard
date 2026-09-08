<template>
  <div class="chart-card">
    <div class="chart-header">
      <h3>Revenue trend</h3>
      <span class="chart-sub">Last {{ data.length }} months</span>
    </div>
    <svg :viewBox="`0 0 ${width} ${height}`" class="chart-svg" preserveAspectRatio="none">
      <polyline :points="areaPoints" class="area" />
      <polyline :points="linePoints" class="line" />
      <circle
        v-for="(p, i) in plotted"
        :key="i"
        :cx="p.x"
        :cy="p.y"
        r="3.5"
        class="dot"
      />
    </svg>
    <div class="chart-labels">
      <span v-for="d in data" :key="d.month">{{ d.month }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  data: { type: Array, required: true }, // [{ month, value }]
});

const width = 560;
const height = 160;
const padding = 12;

const plotted = computed(() => {
  const values = props.data.map((d) => d.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const step = (width - padding * 2) / (props.data.length - 1);

  return props.data.map((d, i) => ({
    x: padding + i * step,
    y: height - padding - ((d.value - min) / range) * (height - padding * 2),
  }));
});

const linePoints = computed(() => plotted.value.map((p) => `${p.x},${p.y}`).join(" "));

const areaPoints = computed(() => {
  const line = plotted.value.map((p) => `${p.x},${p.y}`).join(" ");
  const last = plotted.value[plotted.value.length - 1];
  const first = plotted.value[0];
  return `${first.x},${height} ${line} ${last.x},${height}`;
});
</script>

<style scoped>
.chart-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 20px 24px 16px;
}

.chart-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 8px;
}

.chart-header h3 {
  font-size: 15px;
}

.chart-sub {
  font-size: 12px;
  color: var(--text-muted);
}

.chart-svg {
  width: 100%;
  height: 160px;
  display: block;
}

.area {
  fill: var(--accent-tint);
  stroke: none;
}

.line {
  fill: none;
  stroke: var(--accent);
  stroke-width: 2.25;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.dot {
  fill: var(--surface);
  stroke: var(--accent);
  stroke-width: 2;
}

.chart-labels {
  display: flex;
  justify-content: space-between;
  padding: 6px 4px 0;
  font-size: 11.5px;
  color: var(--text-muted);
}
</style>
