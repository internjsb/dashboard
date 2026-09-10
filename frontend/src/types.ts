// Shared domain types for the dashboard. Kept in one place since both the
// auth context, the route guard, and several views/components need the same
// shapes for the data the backend returns.

export type Role = "admin" | "user";
export type UserStatus = "pending" | "active" | "denied" | "disabled" | "unknown";

export interface StatItem {
  label: string;
  value: number;
  delta: number;
  unit?: "count" | "currency" | "percent";
}

export interface RevenuePoint {
  month: string;
  value: number;
}

export interface CategorySlice {
  category: string;
  value: number;
}

export interface ProductInfo {
  name: string;
  asin: string;
  price: number;
  rating: number;
  reviews: number;
  stock: number;
  unitsLifetime: number;
}

export interface VariantRow {
  finish: string;
  units: number;
  revenue: number;
  stock: number;
  rating: number;
}

export type SalesPeriod = "daily" | "weekly" | "monthly" | "yearly";

export type OrderStatus = "pending" | "shipped" | "delivered" | "returned";

export interface OrderRow {
  id: string;
  finish: string;
  qty: number;
  total: number;
  status: OrderStatus;
  time: string;
}

export interface DashboardOverview {
  product: ProductInfo;
  stats: Record<string, StatItem>;
  revenueTrend: RevenuePoint[];
  salesByFinish: CategorySlice[];
  variants: VariantRow[];
  variantsByPeriod: Record<SalesPeriod, VariantRow[]>;
  recentOrders: OrderRow[];
}

export interface MonthlySalesPoint {
  month: string;
  revenue: number;
  units: number;
}

export interface TopItemRow {
  name: string;
  views: number;
  clicks: number;
  addToCart: number;
  purchases: number;
}

export interface CountrySalesRow {
  country: string;
  revenue: number;
  orders: number;
}

export interface UserGrowthPoint {
  month: string;
  total: number;
  added: number;
}

export interface SalesHistoryData {
  summary: Record<string, StatItem>;
  monthlySales: MonthlySalesPoint[];
  topItems: TopItemRow[];
  topCountries: CountrySalesRow[];
  userGrowth: UserGrowthPoint[];
}

export type StockStatus = "ok" | "low" | "out";

export interface StockItem {
  finish: string;
  available: number;
  inbound: number;
  reorderLevel: number;
  status: StockStatus;
}

export interface StockCountry {
  country: string;
  warehouse: string;
  available: number;
}

export interface StockAvailableData {
  byItem: StockItem[];
  byCountry: StockCountry[];
}

export interface MeResponse {
  role: Role | null;
  status: UserStatus | null;
  isSuperAdmin: boolean;
}

export interface UserRecord {
  uid: string;
  email: string;
  role: Role;
  status: UserStatus;
  isSuperAdmin: boolean;
  disabled?: boolean;
  createdAt: string | null;
}

export interface PendingRequest {
  uid: string;
  email: string;
  displayName?: string;
}

export interface AuditEvent {
  id: string;
  at: number;
  actorUid: string | null;
  actorEmail: string | null;
  action: string;
  detail?: Record<string, unknown> | null;
  userAgent: string;
}
