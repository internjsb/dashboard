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

// --- Per-finish detail (variant cards + "Sales by finish" donut) ----------
// Units + revenue per finish for each reporting window. Stock and rating are
// point-in-time so they're the same across every period.
export const variantsByPeriod = {
  daily: [
    { finish: "Smart Luggage Lock", units: 31, revenue: 4030, stock: 168, rating: 4.6 },
    { finish: "5th GEN Outdoor Smart Padlock", units: 15, revenue: 1950, stock: 132, rating: 4.5 },
    { finish: "4th GEN. Outdoor Smart Padlock", units: 7, revenue: 910, stock: 24, rating: 4.4 },
    { finish: "Smart Lockout Tagout Lock (RED)", units: 3, revenue: 390, stock: 0, rating: 4.3 },
  ],
  weekly: [
    { finish: "Smart Luggage Lock", units: 198, revenue: 25740, stock: 168, rating: 4.6 },
    { finish: "5th GEN Outdoor Smart Padlock", units: 121, revenue: 15730, stock: 132, rating: 4.5 },
    { finish: "4th GEN. Outdoor Smart Padlock", units: 64, revenue: 8320, stock: 24, rating: 4.4 },
    { finish: "Smart Lockout Tagout Lock (RED)", units: 33, revenue: 4290, stock: 0, rating: 4.3 },
  ],
  monthly: [
    { finish: "Smart Luggage Lock", units: 742, revenue: 96500, stock: 168, rating: 4.6 },
    { finish: "5th GEN Outdoor Smart Padlock", units: 548, revenue: 71200, stock: 132, rating: 4.5 },
    { finish: "4th GEN. Outdoor Smart Padlock", units: 299, revenue: 38900, stock: 24, rating: 4.4 },
    { finish: "Smart Lockout Tagout Lock (RED)", units: 168, revenue: 21800, stock: 0, rating: 4.3 },
  ],
  yearly: [
    { finish: "Smart Luggage Lock", units: 8100, revenue: 1053000, stock: 168, rating: 4.6 },
    { finish: "5th GEN Outdoor Smart Padlock", units: 6900, revenue: 897000, stock: 132, rating: 4.5 },
    { finish: "4th GEN. Outdoor Smart Padlock", units: 4200, revenue: 546000, stock: 24, rating: 4.4 },
    { finish: "Smart Lockout Tagout Lock (RED)", units: 2600, revenue: 338000, stock: 0, rating: 4.3 },
  ],
};

// The plain 30-day view, kept for the /stock endpoint and the overview payload.
export const variants = variantsByPeriod.monthly;

// --- Recent orders (activity feed) ------------------------------
export const recentOrders = [
  { id: "111-2938471-0011", finish: "Smart Luggage Lock", qty: 1, total: 129.99, status: "shipped", time: "9 min ago" },
  { id: "112-8471920-4432", finish: "5th GEN Outdoor Smart Padlock", qty: 2, total: 259.98, status: "pending", time: "31 min ago" },
  { id: "114-5563011-9910", finish: "Smart Luggage Lock with Patented Dual Access Tech, NFC + Bluetooth, Vicinity Tracking", qty: 1, total: 129.99, status: "delivered", time: "1 hr ago" },
  { id: "113-9982004-1177", finish: "4th GEN. Outdoor Smart Padlock", qty: 1, total: 129.99, status: "returned", time: "3 hr ago" },
  { id: "111-7741200-3388", finish: "Smart Luggage Lock with Patented Dual Access Tech, NFC + Bluetooth, Vicinity Tracking", qty: 1, total: 129.99, status: "shipped", time: "4 hr ago" },
  { id: "112-3300561-7742", finish: "4th GEN. Smart Padlock, Weatherproof,", qty: 1, total: 129.99, status: "delivered", time: "Yesterday" },
];




// --- Sales history page ---------------------------------------------------
// Twelve months of trailing history: how much sold, which items pull the most
// traffic, which countries buy the most, and how the user base is growing.
export const salesHistory = {
  // Headline tiles (StatCard row).
  summary: {
    revenue: { label: "Total Sales (12 mo)", value: 2438500, delta: 14.2, unit: "currency" },
    orders: { label: "Orders (12 mo)", value: 18740, delta: 10.6, unit: "count" },
    aov: { label: "Avg Order Value", value: 130.12, delta: 1.8, unit: "currency" },
    newUsers: { label: "New Users (12 mo)", value: 3120, delta: 22.5, unit: "count" },
  },

  // Revenue + units per month, oldest first.
  monthlySales: [
    { month: "Oct", revenue: 168400, units: 1296 },
    { month: "Nov", revenue: 201900, units: 1554 },
    { month: "Dec", revenue: 244600, units: 1882 },
    { month: "Jan", revenue: 178200, units: 1371 },
    { month: "Feb", revenue: 183500, units: 1412 },
    { month: "Mar", revenue: 196700, units: 1513 },
    { month: "Apr", revenue: 205300, units: 1579 },
    { month: "May", revenue: 214800, units: 1652 },
    { month: "Jun", revenue: 208100, units: 1601 },
    { month: "Jul", revenue: 223400, units: 1719 },
    { month: "Aug", revenue: 231600, units: 1782 },
    { month: "Sep", revenue: 228400, units: 1757 },
  ],

  // Storefront engagement per item, most-visited first.
  topItems: [
    { name: "Smart Luggage Lock", views: 48210, clicks: 15940, addToCart: 4120, purchases: 2210 },
    { name: "5th GEN Outdoor Smart Padlock", views: 39880, clicks: 12470, addToCart: 3180, purchases: 1648 },
    { name: "4th GEN. Outdoor Smart Padlock", views: 24560, clicks: 6890, addToCart: 1490, purchases: 812 },
    { name: "Smart Lockout Tagout Lock (RED)", views: 11230, clicks: 2980, addToCart: 640, purchases: 301 },
    { name: "Smart Padlock Replacement Shackle", views: 7620, clicks: 1510, addToCart: 410, purchases: 188 },
  ],

  // Sales by ship-to country, highest revenue first.
  topCountries: [
    { country: "United States", revenue: 1465000, orders: 11240 },
    { country: "United Kingdom", revenue: 318900, orders: 2470 },
    { country: "Germany", revenue: 254300, orders: 1980 },
    { country: "Canada", revenue: 201700, orders: 1560 },
    { country: "Australia", revenue: 133200, orders: 1010 },
    { country: "France", revenue: 65400, orders: 480 },
  ],

  // Total registered users at each month end, plus how many were new that month.
  userGrowth: [
    { month: "Oct", total: 6120, added: 180 },
    { month: "Nov", total: 6360, added: 240 },
    { month: "Dec", total: 6690, added: 330 },
    { month: "Jan", total: 6980, added: 290 },
    { month: "Feb", total: 7210, added: 230 },
    { month: "Mar", total: 7520, added: 310 },
    { month: "Apr", total: 7880, added: 360 },
    { month: "May", total: 8210, added: 330 },
    { month: "Jun", total: 8540, added: 330 },
    { month: "Jul", total: 8880, added: 340 },
    { month: "Aug", total: 9160, added: 280 },
    { month: "Sep", total: 9400, added: 240 },
  ],
};

// Used by the seed script to create two sample logins.
export const sampleUsers = [
  { email: "admin@example.com", password: "Password", role: "admin", displayName: "intern the Admin" },
  { email: "user@example.com", password: "Password", role: "user", displayName: "internjsb" },
];
