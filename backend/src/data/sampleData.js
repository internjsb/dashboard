// Placeholder analytics for a single-product Amazon store: one smart lock,
// sold in a few finishes. Replace with real reads from Realtime Database /
// Firestore / the Amazon Selling Partner API once you have live numbers.

// --- The product ------------------------------------------------------
export const product = {
  name: "Egeetounch 5th GEN Outdoor Smart Padlock",
  asin: "B0CSMARTLK",
  price: 129.99,
  rating: 4.5,
  reviews: 2874,
  stock: 324,
  unitsLifetime: 41280,
};

// --- Headline KPIs (the stat-card row) --------------------------------
export const stats = {
  units: { label: "Units Sold (30d)", value: 1757, delta: 9.3, unit: "count" },
  revenue: { label: "Revenue (30d)", value: 228400, delta: 11.1, unit: "currency" },
  avgPrice: { label: "Avg Sale Price", value: 129.99, delta: 0.4, unit: "currency" },
  returnRate: { label: "Return Rate", value: 3.4, delta: -0.6, unit: "percent" },
};

// --- Revenue over time (line chart) ---------------------------------
export const revenueTrend = [
  { month: "Mar", value: 176200 },
  { month: "Apr", value: 188900 },
  { month: "May", value: 201400 },
  { month: "Jun", value: 195700 },
  { month: "Jul", value: 214300 },
  { month: "Aug", value: 221800 },
  { month: "Sep", value: 228400 },
];

// --- Sales split by finish (donut / pie) --------------------------
export const salesByFinish = [
  { category: "Smart Luggage Lock", value: 96500 },
  { category: "5th GEN Outdoor Smart Padlock", value: 71200 },
  { category: "4th GEN. Outdoor Smart Padlock", value: 38900 },
  { category: "Smart Lockout Tagout Lock (RED)", value: 21800 },
];

// --- Per-finish detail (variant cards) --------------------------
export const variants = [
  { finish: "Smart Luggage Lock", units: 742, revenue: 96500, stock: 168, rating: 4.6 },
  { finish: "5th GEN Outdoor Smart Padlock", units: 548, revenue: 71200, stock: 132, rating: 4.5 },
  { finish: "4th GEN. Outdoor Smart Padlock", units: 299, revenue: 38900, stock: 24, rating: 4.4 },
  { finish: "Smart Lockout Tagout Lock (RED)", units: 168, revenue: 21800, stock: 0, rating: 4.3 },
];

// --- Recent orders (activity feed) ------------------------------
export const recentOrders = [
  { id: "111-2938471-0011", finish: "Smart Luggage Lock", qty: 1, total: 129.99, status: "shipped", time: "9 min ago" },
  { id: "112-8471920-4432", finish: "5th GEN Outdoor Smart Padlock", qty: 2, total: 259.98, status: "pending", time: "31 min ago" },
  { id: "114-5563011-9910", finish: "Smart Luggage Lock with Patented Dual Access Tech, NFC + Bluetooth, Vicinity Tracking", qty: 1, total: 129.99, status: "delivered", time: "1 hr ago" },
  { id: "113-9982004-1177", finish: "4th GEN. Outdoor Smart Padlock", qty: 1, total: 129.99, status: "returned", time: "3 hr ago" },
  { id: "111-7741200-3388", finish: "Smart Luggage Lock with Patented Dual Access Tech, NFC + Bluetooth, Vicinity Tracking", qty: 1, total: 129.99, status: "shipped", time: "4 hr ago" },
  { id: "112-3300561-7742", finish: "4th GEN. Smart Padlock, Weatherproof,", qty: 1, total: 129.99, status: "delivered", time: "Yesterday" },
];

// Used by the seed script to create two sample logins.
export const sampleUsers = [
  { email: "admin@example.com", password: "Password", role: "admin", displayName: "intern the Admin" },
  { email: "user@example.com", password: "Password", role: "user", displayName: "internjsb" },
];
