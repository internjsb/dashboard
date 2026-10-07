// Per-user page access — mirrors backend/src/middleware/authMiddleware.js's
// requirePageAccess exactly. This only controls what the UI shows/routes to;
// the backend enforces the same rule independently on every request. Each
// user's grants live at users/{uid}/pageAccess in the database (edited from
// the "Page management" admin page), not derived from their department —
// department is purely an informational tag now.
export type PageKey =
  | "dashboard"
  | "sales_history"
  | "stock_available"
  | "inventory"
  | "finance"
  | "products"
  | "product_listings"
  | "sale_report";

export type PageAccessMap = Partial<Record<PageKey, boolean>>;

export const PAGE_LABEL: Record<PageKey, string> = {
  dashboard: "Dashboard",
  sales_history: "Sales history",
  stock_available: "Stock availability",
  inventory: "Inventory",
  finance: "Finance",
  products: "Products",
  product_listings: "AMAZON Listing",
  sale_report: "Sales report",
};

const PAGE_PATH: Record<PageKey, string> = {
  dashboard: "/dashboard",
  sales_history: "/sales-history",
  stock_available: "/stock-available",
  inventory: "/inventory",
  finance: "/finance",
  products: "/products",
  product_listings: "/product-listings",
  sale_report: "/sale-report",
};

// Only the one true super admin (isSuperAdmin) bypasses everything. Being
// "admin" role no longer grants blanket access to the business pages — a
// promoted admin sees only whatever's checked for them on the Page
// management screen, same as anyone else. They still keep Manage users /
// Audit log / Page management separately (those are gated on role, not
// per-page grants). No grant at all = no access.
export function canAccessPage(
  isSuperAdmin: boolean,
  pageAccess: PageAccessMap | null | undefined,
  page: PageKey,
): boolean {
  if (isSuperAdmin) return true;
  return !!pageAccess?.[page];
}

// Where to send a signed-in user who doesn't specify a path (e.g. "/"), or
// who landed on a page they can't see. Falls back to their profile — always
// safe to view — if they have no accessible business page at all.
export function defaultPageFor(isSuperAdmin: boolean, pageAccess: PageAccessMap | null | undefined): string {
  const order: PageKey[] = [
    "dashboard",
    "sales_history",
    "sale_report",
    "stock_available",
    "inventory",
    "finance",
    "products",
    "product_listings",
  ];
  const first = order.find((page) => canAccessPage(isSuperAdmin, pageAccess, page));
  return first ? PAGE_PATH[first] : "/profile";
}
