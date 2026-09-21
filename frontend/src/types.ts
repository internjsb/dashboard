// Shared domain types for the dashboard. Kept in one place since both the
// auth context, the route guard, and several views/components need the same
// shapes for the data the backend returns.

export type Role = "admin" | "user";
export type UserStatus = "pending" | "active" | "denied" | "disabled" | "unknown";

// Department tag — separate from Role above. Purely informational (which
// team someone's on), assignable by any admin.
export type Department = "super_user" | "sales" | "supplychain" | "finance";

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
  sku: string;
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
  sku: string;
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
  sku: string;
  finish: string;
  available: number;
  inbound: number;
  reorderLevel: number;
  status: StockStatus;
}

export interface StockCountry {
  sku: string;
  country: string;
  warehouse: string;
  available: number;
}

export interface InventoryRow {
  sku: string;
  dtiItemCode: string;
  finish: string;
  warehouse: string;
  country: string;
  onHand: number;
  reserved: number;
  available: number;
}

export type ShipmentStatus = "in_transit" | "customs" | "delayed" | "arrived";

export interface ShipmentRow {
  id: string;
  sku: string;
  finish: string;
  quantity: number;
  origin: string;
  destination: string;
  carrier: string;
  eta: string;
  status: ShipmentStatus;
}

export interface StockAvailableData {
  byItem: StockItem[];
  byCountry: StockCountry[];
  inventory: InventoryRow[];
  shipments: ShipmentRow[];
}

// --- Finance page ----------------------------------------------------
export type TransactionType = "sale" | "refund" | "payout" | "fee" | "advertising";
export type TransactionStatus = "completed" | "pending";

export interface TransactionRow {
  id: string;
  date: string;
  type: TransactionType;
  sku: string;
  description: string;
  amount: number;
  status: TransactionStatus;
}

export type TaxStatus = "filed" | "pending";

export interface TaxRow {
  id: string;
  sku: string;
  jurisdiction: string;
  period: string;
  taxableSales: number;
  taxCollected: number;
  status: TaxStatus;
}

export type ReportStatus = "final" | "draft";

export interface FinanceReportRow {
  id: string;
  sku: string;
  name: string;
  period: string;
  type: string;
  generatedOn: string;
  status: ReportStatus;
}

export interface FinanceData {
  transactions: TransactionRow[];
  taxes: TaxRow[];
  reports: FinanceReportRow[];
}

export interface MeResponse {
  role: Role | null;
  status: UserStatus | null;
  department: Department | null;
  isSuperAdmin: boolean;
  twoFactorEnabled: boolean;
}

export interface UserRecord {
  uid: string;
  email: string;
  role: Role;
  status: UserStatus;
  department?: Department | null;
  isSuperAdmin: boolean;
  disabled?: boolean;
  createdAt: string | null;
}

export interface PendingRequest {
  uid: string;
  email: string;
  displayName?: string;
  department?: Department | null;
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
