<template>
  <div class="activity-card">
    <h3>Recent activity</h3>
    <ul>
      <li v-for="item in items" :key="item.id">
        <div class="dot" />
        <div class="body">
          <p><strong>{{ item.actor }}</strong> {{ item.action }}</p>
          <span class="time">{{ item.time }}</span>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup>
defineProps({ items: { type: Array, required: true } });
</script>

<style scoped>
.activity-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 20px 24px;
}

h3 {
  font-size: 15px;
  margin-bottom: 14px;
}

ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

li {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  margin-top: 6px;
  flex-shrink: 0;
}

.body p {
  margin: 0;
  font-size: 13.5px;
  color: var(--text-primary);
}

.time {
  font-size: 12px;
  color: var(--text-muted);
}
</style>
