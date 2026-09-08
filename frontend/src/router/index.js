import { createRouter, createWebHistory } from "vue-router";
import { useAuth } from "../composables/useAuth";

const routes = [
  { path: "/", redirect: "/dashboard" },
  {
    path: "/login",
    component: () => import("../views/Login.vue"),
    meta: { public: true },
  },
  {
    path: "/dashboard",
    component: () => import("../views/Dashboard.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/admin",
    component: () => import("../views/AdminPanel.vue"),
    meta: { requiresAuth: true, role: "admin" },
  },
  {
    path: "/forbidden",
    component: () => import("../views/Forbidden.vue"),
    meta: { public: true },
  },
  {
    path: "/:pathMatch(.*)*",
    component: () => import("../views/NotFound.vue"),
    meta: { public: true },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  if (to.meta.public) return true;

  const { user, role, waitUntilReady } = useAuth();
  // Wait for Firebase's first auth-state report so a page refresh doesn't
  // wrongly look logged-out while that check is still in flight.
  await waitUntilReady();

  if (to.meta.requiresAuth && !user.value) {
    return { path: "/login", query: { redirect: to.fullPath } };
  }

  if (to.meta.role && to.meta.role !== role.value) {
    return { path: "/forbidden" };
  }

  return true;
});

export default router;
