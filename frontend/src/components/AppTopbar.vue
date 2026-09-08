<template>
  <header class="topbar">
    <h2>{{ title }}</h2>
    <div class="topbar-right">
      <span class="date">{{ today }}</span>
    </div>
  </header>
</template>

<script setup>
defineProps({ title: { type: String, default: "" } });

const today = new Date().toLocaleDateString(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
});
</script>

<style scoped>
.topbar {
  height: var(--topbar-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
  position: sticky;
  top: 0;
  z-index: 5;
}

h2 {
  font-size: 18px;
}

.date {
  font-size: 13px;
  color: var(--text-secondary);
}
</style>
