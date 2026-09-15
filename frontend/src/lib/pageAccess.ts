// Which departments can see which business page — mirrors
// backend/src/middleware/authMiddleware.js's PAGE_DEPARTMENTS exactly. This
// only controls what the UI shows/routes to; the backend enforces the same
// rule independently on every request.
import type { Department } from "../types";

export type PageKey = "dashboard" | "sales_history" | "stock_available" | "finance";

const PAGE_DEPARTMENTS: Record<PageKey, Department[]> = {
  dashboard: ["super_user", "sales"],
  sales_history: ["super_user", "sales"],
  stock_available: ["super_user", "supplychain"],
  finance: ["super_user", "finance"],
};

const PAGE_PATH: Record<PageKey, string> = {
  dashboard: "/dashboard",
  sales_history: "/sales-history",
  stock_available: "/stock-available",
  finance: "/finance",
};

// Only the one true super admin (isSuperAdmin) bypasses everything. Being
// "admin" role no longer grants blanket access to the business pages —
// promoted admins see only what their own department grants here, same as
// anyone else. They still keep Manage users / Audit log separately (those
// are gated on role, not department). No department at all = no access.
export function canAccessPage(
  isSuperAdmin: boolean,
  department: Department | null | undefined,
  page: PageKey,
): boolean {
  if (isSuperAdmin) return true;
  if (!department) return false;
  return PAGE_DEPARTMENTS[page].includes(department);
}

// Where to send a signed-in user who doesn't specify a path (e.g. "/"), or
// who landed on a page they can't see. Falls back to their profile — always
// safe to view — if they have no accessible business page at all.
export function defaultPageFor(isSuperAdmin: boolean, department: Department | null | undefined): string {
  const order: PageKey[] = ["dashboard", "sales_history", "stock_available", "finance"];
  const first = order.find((page) => canAccessPage(isSuperAdmin, department, page));
  return first ? PAGE_PATH[first] : "/profile";
}
