<template>
  <div class="layout">
    <AppSidebar />
    <div class="content-area">
      <AppTopbar title="Dashboard" />
      <main class="content">
        <p v-if="loading" class="state">Loading…</p>
        <p v-else-if="error" class="state error">{{ error }}</p>
        <template v-else>
          <section class="stats-grid">
            <StatCard
              v-for="(stat, key, i) in overview.stats"
              :key="key"
              v-bind="stat"
              :featured="i === 0"
            />
          </section>

          <section class="main-grid">
            <RevenueChart :data="overview.revenueTrend" />
            <RecentActivity :items="overview.recentActivity" />
          </section>
        </template>
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import AppSidebar from "../components/AppSidebar.vue";
import AppTopbar from "../components/AppTopbar.vue";
import StatCard from "../components/StatCard.vue";
import RevenueChart from "../components/RevenueChart.vue";
import RecentActivity from "../components/RecentActivity.vue";
import api from "../api/client";

const overview = ref({ stats: {}, revenueTrend: [], recentActivity: [] });
const loading = ref(true);
const error = ref("");

onMounted(async () => {
  try {
    const { data } = await api.get("/dashboard/overview");
    overview.value = data;
  } catch (err) {
    error.value = "Couldn't load dashboard data. Is the backend running?";
    console.error(err);
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.layout {
  display: flex;
  min-height: 100vh;
}

.content-area {
  flex: 1;
  margin-left: var(--sidebar-width);
}

.content {
  padding: 28px 32px 48px;
  max-width: 1080px;
}

.state {
  color: var(--text-secondary);
  font-size: 14px;
}

.state.error {
  color: var(--danger);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

.main-grid {
  display: grid;
  grid-template-columns: 1.6fr 1fr;
  gap: 16px;
}

@media (max-width: 900px) {
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
  .main-grid { grid-template-columns: 1fr; }
}
</style>
