<template>
  <div class="stat-card" :class="{ featured }">
    <span class="label">{{ label }}</span>
    <span class="value">{{ formattedValue }}</span>
    <span class="delta" :class="delta >= 0 ? 'up' : 'down'">
      {{ delta >= 0 ? "▲" : "▼" }} {{ Math.abs(delta) }}%
    </span>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  label: String,
  value: Number,
  delta: Number,
  unit: { type: String, default: "count" },
  featured: { type: Boolean, default: false },
});

const formattedValue = computed(() => {
  if (props.unit === "currency") {
    return `$${props.value.toLocaleString()}`;
  }
  if (props.unit === "percent") {
    return `${props.value}%`;
  }
  return props.value.toLocaleString();
});
</script>

<style scoped>
.stat-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* The first card gets a distinct accent-bar treatment so the row isn't four
   identical cards — a deliberate break from the generic SaaS-card sameness. */
.stat-card.featured {
  border-left: 3px solid var(--accent);
}

.label {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
}

.value {
  font-family: var(--font-display);
  font-size: 26px;
  font-weight: 800;
  color: var(--text-primary);
}

.delta {
  font-size: 12.5px;
  font-weight: 600;
  width: fit-content;
}

.delta.up { color: var(--success); }
.delta.down { color: var(--danger); }
</style>
