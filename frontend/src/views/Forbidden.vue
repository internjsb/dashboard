<template>
  <div class="wrap">
    <h1>403</h1>
    <p>You don't have access to that page.</p>
    <router-link to="/dashboard" class="back">Back to dashboard</router-link>
  </div>
</template>

<style scoped>
.wrap {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-align: center;
  color: var(--text-primary);
}

h1 {
  font-size: 48px;
  color: var(--danger);
}

p {
  color: var(--text-secondary);
  margin: 0 0 12px;
}

.back {
  color: var(--accent);
  font-weight: 600;
  font-size: 14px;
}
</style>
