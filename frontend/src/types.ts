// Shared domain types for the dashboard. Kept in one place since both the
// auth context, the route guard, and several views/components need the same
// shapes for the data the backend returns.

export type Role = "admin" | "user";
export type UserStatus = "pending" | "active" | "denied" | "unknown";

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
  recentOrders: OrderRow[];
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
  createdAt: string | null;
}

export interface PendingRequest {
  uid: string;
  email: string;
  displayName?: string;
}
