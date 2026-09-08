<template>
  <aside class="sidebar">
    <div class="brand">
      <div class="brand-mark">A</div>
      <span>Ops Console</span>
    </div>

    <nav class="nav">
      <router-link to="/dashboard" class="nav-item" active-class="active">
        <span class="dot" />
        Dashboard
      </router-link>
      <router-link v-if="role === 'admin'" to="/admin" class="nav-item" active-class="active">
        <span class="dot" />
        Manage users
      </router-link>
    </nav>

    <div class="sidebar-footer">
      <div class="user-line">
        <div class="avatar">{{ initials }}</div>
        <div class="user-meta">
          <span class="email">{{ user?.email }}</span>
          <span class="role-tag" :class="role">{{ role }}</span>
        </div>
      </div>
      <button class="signout" @click="handleSignOut">Sign out</button>
    </div>
  </aside>
</template>

<script setup>
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useAuth } from "../composables/useAuth";

const { user, role, signOut } = useAuth();
const router = useRouter();

const initials = computed(() => {
  const email = user.value?.email || "";
  return email.slice(0, 2).toUpperCase();
});

async function handleSignOut() {
  await signOut();
  router.push("/login");
}
</script>

<style scoped>
.sidebar {
  width: var(--sidebar-width);
  min-height: 100vh;
  background: var(--sidebar-bg);
  color: var(--sidebar-text);
  display: flex;
  flex-direction: column;
  padding: 20px 16px;
  position: fixed;
  left: 0;
  top: 0;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px 24px;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 14px;
  color: var(--sidebar-text-active);
}

.brand-mark {
  width: 26px;
  height: 26px;
  border-radius: 7px;
  background: var(--accent);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 13px;
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 500;
  color: var(--sidebar-text);
}

.nav-item:hover {
  background: var(--sidebar-bg-hover);
  color: var(--sidebar-text-active);
}

.nav-item.active {
  background: var(--sidebar-bg-hover);
  color: var(--sidebar-text-active);
}

.nav-item .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.5;
}

.nav-item.active .dot {
  background: var(--accent);
  opacity: 1;
}

.sidebar-footer {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-top: 14px;
}

.user-line {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--accent-tint);
  color: var(--accent-strong);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

.user-meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.email {
  font-size: 12.5px;
  color: var(--sidebar-text-active);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.role-tag {
  font-size: 11px;
  text-transform: capitalize;
  color: var(--sidebar-text);
  width: fit-content;
}

.role-tag.admin { color: #6FD7C4; }

.signout {
  width: 100%;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: var(--sidebar-text-active);
  padding: 8px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 600;
}

.signout:hover {
  background: var(--sidebar-bg-hover);
}
</style>
