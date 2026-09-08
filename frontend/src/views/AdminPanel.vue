<template>
  <div class="layout">
    <AppSidebar />
    <div class="content-area">
      <AppTopbar title="Manage users" />
      <main class="content">
        <p class="intro">
          You're the super admin — promote or demote anyone below. Everyone else defaults to
          <strong>user</strong> access until you change it.
        </p>

        <p v-if="loading" class="state">Loading…</p>
        <p v-else-if="error" class="state error">{{ error }}</p>

        <table v-else class="user-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Joined</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in users" :key="u.uid">
              <td>
                <div class="user-cell">
                  <div class="avatar">{{ (u.email || "?").slice(0, 2).toUpperCase() }}</div>
                  <div>
                    <div class="email">{{ u.email }}</div>
                    <div class="uid">{{ u.uid }}</div>
                  </div>
                </div>
              </td>
              <td><span class="role-pill" :class="u.role">{{ u.role }}</span></td>
              <td class="joined">{{ formatDate(u.createdAt) }}</td>
              <td class="actions">
                <button
                  v-if="u.role !== 'admin'"
                  class="promote"
                  :disabled="updatingUid === u.uid"
                  @click="changeRole(u, 'admin')"
                >
                  Make admin
                </button>
                <button
                  v-else
                  class="demote"
                  :disabled="updatingUid === u.uid || u.uid === currentUid"
                  @click="changeRole(u, 'user')"
                >
                  Revoke admin
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import AppSidebar from "../components/AppSidebar.vue";
import AppTopbar from "../components/AppTopbar.vue";
import api from "../api/client";
import { useAuth } from "../composables/useAuth";

const { user } = useAuth();
const currentUid = user.value?.uid;

const users = ref([]);
const loading = ref(true);
const error = ref("");
const updatingUid = ref(null);

async function loadUsers() {
  loading.value = true;
  try {
    const { data } = await api.get("/users");
    users.value = data.users;
  } catch (err) {
    error.value = "Couldn't load users. Is the backend running?";
    console.error(err);
  } finally {
    loading.value = false;
  }
}

async function changeRole(targetUser, role) {
  updatingUid.value = targetUser.uid;
  try {
    await api.patch(`/users/${targetUser.uid}/role`, { role });
    targetUser.role = role;
  } catch (err) {
    alert(err.response?.data?.error || "Failed to update role");
  } finally {
    updatingUid.value = null;
  }
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

onMounted(loadUsers);
</script>

<style scoped>
.layout { display: flex; min-height: 100vh; }
.content-area { flex: 1; margin-left: var(--sidebar-width); }
.content { padding: 28px 32px 48px; max-width: 1080px; }

.intro {
  font-size: 13.5px;
  color: var(--text-secondary);
  margin: 0 0 20px;
}

.state { color: var(--text-secondary); font-size: 14px; }
.state.error { color: var(--danger); }

.user-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

thead th {
  text-align: left;
  font-size: 12px;
  text-transform: none;
  color: var(--text-muted);
  font-weight: 600;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}

tbody td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  font-size: 13.5px;
  vertical-align: middle;
}

tbody tr:last-child td { border-bottom: none; }

.user-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--accent-tint);
  color: var(--accent-strong);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}

.email { font-weight: 500; }
.uid { font-size: 11px; color: var(--text-muted); }
.joined { color: var(--text-secondary); }

.role-pill {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  text-transform: capitalize;
  background: var(--bg);
  color: var(--text-secondary);
}

.role-pill.admin {
  background: var(--accent-tint);
  color: var(--accent-strong);
}

.actions { text-align: right; }

.actions button {
  border: 1px solid var(--border);
  background: var(--surface);
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  font-size: 12.5px;
  font-weight: 600;
}

.actions .promote {
  border-color: var(--accent);
  color: var(--accent-strong);
}

.actions .demote {
  border-color: var(--danger);
  color: var(--danger);
}

.actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
