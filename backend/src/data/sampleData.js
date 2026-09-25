// Placeholder analytics for a single-product Amazon store: one smart lock,
// sold in a few finishes. Replace with real reads from Realtime Database /
// Firestore / the Amazon Selling Partner API once you have live numbers.

// --- The product ------------------------------------------------------
export const product = {
  sku: "SKU-00086",
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

// --- Stock available page ------------------------------------------------
// On-hand inventory per finish and per fulfilment country. An item counts as
// "low" when available stock is at or below its reorder level.
export const stockAvailable = {
  byItem: [
    { sku: "SKU-LUG-001", finish: "Smart Luggage Lock", available: 168, inbound: 105, reorderLevel: 80 },
    { sku: "SKU-PAD-005", finish: "5th GEN Outdoor Smart Padlock", available: 132, inbound: 55, reorderLevel: 90 },
    { sku: "SKU-PAD-004", finish: "4th GEN. Outdoor Smart Padlock", available: 24, inbound: 0, reorderLevel: 60 },
    { sku: "SKU-LOTO-RED", finish: "Smart Lockout Tagout Lock (RED)", available: 0, inbound: 150, reorderLevel: 40 },
    { sku: "SKU-SHACKLE-001", finish: "Smart Padlock Replacement Shackle", available: 312, inbound: 0, reorderLevel: 100 },
  ],
  byCountry: [
    { sku: "SKU-LUG-001", country: "United States", warehouse: "Phoenix, AZ · FTW1", available: 64 },
    { sku: "SKU-PAD-005", country: "United States", warehouse: "Phoenix, AZ · FTW1", available: 61 },
    { sku: "SKU-PAD-004", country: "United States", warehouse: "Phoenix, AZ · FTW1", available: 14 },
    { sku: "SKU-LOTO-RED", country: "United States", warehouse: "Phoenix, AZ · FTW1", available: 0 },
    { sku: "SKU-SHACKLE-001", country: "United States", warehouse: "Phoenix, AZ · FTW1", available: 160 },
    { sku: "SKU-LUG-001", country: "Germany", warehouse: "Leipzig · LEJ1", available: 44 },
    { sku: "SKU-PAD-005", country: "Germany", warehouse: "Leipzig · LEJ1", available: 35 },
    { sku: "SKU-SHACKLE-001", country: "Germany", warehouse: "Leipzig · LEJ1", available: 80 },
    { sku: "SKU-LUG-001", country: "United Kingdom", warehouse: "Rugeley · BHX4", available: 40 },
    { sku: "SKU-PAD-004", country: "United Kingdom", warehouse: "Rugeley · BHX4", available: 10 },
    { sku: "SKU-LUG-001", country: "Canada", warehouse: "Toronto · YYZ4", available: 20 },
    { sku: "SKU-PAD-005", country: "Canada", warehouse: "Toronto · YYZ4", available: 36 },
    { sku: "SKU-SHACKLE-001", country: "Australia", warehouse: "Sydney · SYD2", available: 72 },
    { sku: "SKU-LOTO-RED", country: "Japan", warehouse: "Chiba · NRT5", available: 0 },
  ],

  // Per-item, per-warehouse breakdown — on-hand stock, how much of it is
  // already reserved against open orders, and what's actually sellable.
  inventory: [
    { sku: "SKU-LUG-001", dtiItemCode: "DTI-LUG-001", finish: "Smart Luggage Lock", warehouse: "Phoenix, AZ · FTW1", country: "United States", onHand: 73, reserved: 9, available: 64 },
    { sku: "SKU-LUG-001", dtiItemCode: "DTI-LUG-001", finish: "Smart Luggage Lock", warehouse: "Leipzig · LEJ1", country: "Germany", onHand: 52, reserved: 8, available: 44 },
    { sku: "SKU-LUG-001", dtiItemCode: "DTI-LUG-001", finish: "Smart Luggage Lock", warehouse: "Rugeley · BHX4", country: "United Kingdom", onHand: 44, reserved: 4, available: 40 },
    { sku: "SKU-LUG-001", dtiItemCode: "DTI-LUG-001", finish: "Smart Luggage Lock", warehouse: "Toronto · YYZ4", country: "Canada", onHand: 22, reserved: 2, available: 20 },
    { sku: "SKU-PAD-005", dtiItemCode: "DTI-PAD-005", finish: "5th GEN Outdoor Smart Padlock", warehouse: "Phoenix, AZ · FTW1", country: "United States", onHand: 70, reserved: 9, available: 61 },
    { sku: "SKU-PAD-005", dtiItemCode: "DTI-PAD-005", finish: "5th GEN Outdoor Smart Padlock", warehouse: "Leipzig · LEJ1", country: "Germany", onHand: 40, reserved: 5, available: 35 },
    { sku: "SKU-PAD-005", dtiItemCode: "DTI-PAD-005", finish: "5th GEN Outdoor Smart Padlock", warehouse: "Toronto · YYZ4", country: "Canada", onHand: 40, reserved: 4, available: 36 },
    { sku: "SKU-PAD-004", dtiItemCode: "DTI-PAD-004", finish: "4th GEN. Outdoor Smart Padlock", warehouse: "Phoenix, AZ · FTW1", country: "United States", onHand: 16, reserved: 2, available: 14 },
    { sku: "SKU-PAD-004", dtiItemCode: "DTI-PAD-004", finish: "4th GEN. Outdoor Smart Padlock", warehouse: "Rugeley · BHX4", country: "United Kingdom", onHand: 12, reserved: 2, available: 10 },
    { sku: "SKU-LOTO-RED", dtiItemCode: "DTI-LOTO-RED", finish: "Smart Lockout Tagout Lock (RED)", warehouse: "Phoenix, AZ · FTW1", country: "United States", onHand: 0, reserved: 0, available: 0 },
    { sku: "SKU-LOTO-RED", dtiItemCode: "DTI-LOTO-RED", finish: "Smart Lockout Tagout Lock (RED)", warehouse: "Chiba · NRT5", country: "Japan", onHand: 0, reserved: 0, available: 0 },
    { sku: "SKU-SHACKLE-001", dtiItemCode: "DTI-SHACKLE-001", finish: "Smart Padlock Replacement Shackle", warehouse: "Phoenix, AZ · FTW1", country: "United States", onHand: 180, reserved: 20, available: 160 },
    { sku: "SKU-SHACKLE-001", dtiItemCode: "DTI-SHACKLE-001", finish: "Smart Padlock Replacement Shackle", warehouse: "Leipzig · LEJ1", country: "Germany", onHand: 90, reserved: 10, available: 80 },
    { sku: "SKU-SHACKLE-001", dtiItemCode: "DTI-SHACKLE-001", finish: "Smart Padlock Replacement Shackle", warehouse: "Sydney · SYD2", country: "Australia", onHand: 80, reserved: 8, available: 72 },
  ],

  // Inbound replenishment shipments — the individual shipments that make up
  // each item's "inbound" total above (in-transit/customs/delayed only —
  // "arrived" shipments are historical and already counted in on-hand stock).
  shipments: [
    { id: "SHIP-10199", sku: "SKU-LUG-001", finish: "Smart Luggage Lock", quantity: 25, origin: "Shenzhen, CN", destination: "Rugeley · BHX4", carrier: "Ocean freight", eta: "2026-09-05", status: "arrived" },
    { id: "SHIP-10231", sku: "SKU-LUG-001", finish: "Smart Luggage Lock", quantity: 60, origin: "Shenzhen, CN", destination: "Phoenix, AZ · FTW1", carrier: "Ocean freight", eta: "2026-09-22", status: "in_transit" },
    { id: "SHIP-10232", sku: "SKU-LUG-001", finish: "Smart Luggage Lock", quantity: 30, origin: "Shenzhen, CN", destination: "Leipzig · LEJ1", carrier: "Air freight", eta: "2026-09-18", status: "customs" },
    { id: "SHIP-10233", sku: "SKU-LUG-001", finish: "Smart Luggage Lock", quantity: 15, origin: "Shenzhen, CN", destination: "Sydney · SYD2", carrier: "Ocean freight", eta: "2026-09-30", status: "delayed" },
    { id: "SHIP-10240", sku: "SKU-PAD-005", finish: "5th GEN Outdoor Smart Padlock", quantity: 40, origin: "Ningbo, CN", destination: "Phoenix, AZ · FTW1", carrier: "Ocean freight", eta: "2026-09-25", status: "in_transit" },
    { id: "SHIP-10241", sku: "SKU-PAD-005", finish: "5th GEN Outdoor Smart Padlock", quantity: 15, origin: "Ningbo, CN", destination: "Toronto · YYZ4", carrier: "Air freight", eta: "2026-09-19", status: "customs" },
    { id: "SHIP-10255", sku: "SKU-LOTO-RED", finish: "Smart Lockout Tagout Lock (RED)", quantity: 90, origin: "Ningbo, CN", destination: "Phoenix, AZ · FTW1", carrier: "Ocean freight", eta: "2026-09-20", status: "in_transit" },
    { id: "SHIP-10256", sku: "SKU-LOTO-RED", finish: "Smart Lockout Tagout Lock (RED)", quantity: 60, origin: "Ningbo, CN", destination: "Rugeley · BHX4", carrier: "Air freight", eta: "2026-09-17", status: "delayed" },
  ],
};

// --- Finance page ---------------------------------------------------------
export const finance = {
  transactions: [
    { id: "TXN-98213", date: "2026-09-10", type: "sale", sku: "SKU-LUG-001", description: "Order 111-2938471-0011", amount: 129.99, status: "completed" },
    { id: "TXN-98214", date: "2026-09-10", type: "refund", sku: "SKU-PAD-004", description: "Return — order 113-9982004-1177", amount: -129.99, status: "completed" },
    { id: "TXN-98215", date: "2026-09-09", type: "payout", sku: "SKU-LUG-001", description: "Amazon payout — weekly settlement", amount: -18420.5, status: "completed" },
    { id: "TXN-98216", date: "2026-09-09", type: "fee", sku: "SKU-PAD-005", description: "Referral fee — September batch", amount: -2140.3, status: "completed" },
    { id: "TXN-98217", date: "2026-09-08", type: "sale", sku: "SKU-PAD-005", description: "Order 112-8471920-4432", amount: 259.98, status: "pending" },
    { id: "TXN-98218", date: "2026-09-07", type: "advertising", sku: "SKU-LUG-001", description: "Sponsored Products spend", amount: -640, status: "completed" },
  ],

  taxes: [
    { id: "TAX-US-2026-08", sku: "SKU-LUG-001", jurisdiction: "United States — Federal", period: "Aug 2026", taxableSales: 168400, taxCollected: 11788, status: "filed" },
    { id: "TAX-US-CA-2026-08", sku: "SKU-PAD-005", jurisdiction: "California, US", period: "Aug 2026", taxableSales: 42300, taxCollected: 3596, status: "filed" },
    { id: "TAX-UK-2026-08", sku: "SKU-PAD-004", jurisdiction: "United Kingdom — VAT", period: "Aug 2026", taxableSales: 31890, taxCollected: 6378, status: "filed" },
    { id: "TAX-DE-2026-08", sku: "SKU-SHACKLE-001", jurisdiction: "Germany — VAT", period: "Aug 2026", taxableSales: 25430, taxCollected: 4832, status: "pending" },
    { id: "TAX-US-2026-09", sku: "SKU-LUG-001", jurisdiction: "United States — Federal", period: "Sep 2026", taxableSales: 96200, taxCollected: 6734, status: "pending" },
  ],

  reports: [
    { id: "RPT-2026-Q2", sku: "SKU-LUG-001", name: "Q2 2026 Income Statement", period: "Apr–Jun 2026", type: "Income statement", generatedOn: "2026-07-05", status: "final" },
    { id: "RPT-2026-08", sku: "SKU-PAD-005", name: "August 2026 P&L", period: "Aug 2026", type: "Profit & loss", generatedOn: "2026-09-02", status: "final" },
    { id: "RPT-2026-09", sku: "SKU-PAD-004", name: "September 2026 P&L", period: "Sep 2026", type: "Profit & loss", generatedOn: "2026-09-14", status: "draft" },
    { id: "RPT-2026-CF-Q2", sku: "SKU-SHACKLE-001", name: "Q2 2026 Cash Flow", period: "Apr–Jun 2026", type: "Cash flow", generatedOn: "2026-07-06", status: "final" },
  ],
};

// --- Recent orders (activity feed) ------------------------------
export const recentOrders = [
  { id: "111-2938471-0011", sku: "SKU-LUG-001", finish: "Smart Luggage Lock", qty: 1, total: 129.99, status: "shipped", time: "9 min ago" },
  { id: "112-8471920-4432", sku: "SKU-PAD-005", finish: "5th GEN Outdoor Smart Padlock", qty: 2, total: 259.98, status: "pending", time: "31 min ago" },
  { id: "114-5563011-9910", sku: "SKU-LUG-001", finish: "Smart Luggage Lock with Patented Dual Access Tech, NFC + Bluetooth, Vicinity Tracking", qty: 1, total: 129.99, status: "delivered", time: "1 hr ago" },
  { id: "113-9982004-1177", sku: "SKU-PAD-004", finish: "4th GEN. Outdoor Smart Padlock", qty: 1, total: 129.99, status: "returned", time: "3 hr ago" },
  { id: "111-7741200-3388", sku: "SKU-LUG-001", finish: "Smart Luggage Lock with Patented Dual Access Tech, NFC + Bluetooth, Vicinity Tracking", qty: 1, total: 129.99, status: "shipped", time: "4 hr ago" },
  { id: "112-3300561-7742", sku: "SKU-PAD-004", finish: "4th GEN. Smart Padlock, Weatherproof,", qty: 1, total: 129.99, status: "delivered", time: "Yesterday" },
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
    { sku: "SKU-LUG-001", month: "Oct", revenue: 168400, units: 1296 },
    { sku: "SKU-LUG-001", month: "Nov", revenue: 201900, units: 1554 },
    { sku: "SKU-LUG-001", month: "Dec", revenue: 244600, units: 1882 },
    { sku: "SKU-LUG-001", month: "Jan", revenue: 178200, units: 1371 },
    { sku: "SKU-LUG-001", month: "Feb", revenue: 183500, units: 1412 },
    { sku: "SKU-LUG-001", month: "Mar", revenue: 196700, units: 1513 },
    { sku: "SKU-LUG-001", month: "Apr", revenue: 205300, units: 1579 },
    { sku: "SKU-LUG-001", month: "May", revenue: 214800, units: 1652 },
    { sku: "SKU-LUG-001", month: "Jun", revenue: 208100, units: 1601 },
    { sku: "SKU-LUG-001", month: "Jul", revenue: 223400, units: 1719 },
    { sku: "SKU-LUG-001", month: "Aug", revenue: 231600, units: 1782 },
    { sku: "SKU-LUG-001", month: "Sep", revenue: 228400, units: 1757 },
  ],

  // Storefront engagement per item, most-visited first.
  topItems: [
    { sku: "SKU-LUG-001", name: "Smart Luggage Lock", views: 48210, clicks: 15940, addToCart: 4120, purchases: 2210 },
    { sku: "SKU-PAD-005", name: "5th GEN Outdoor Smart Padlock", views: 39880, clicks: 12470, addToCart: 3180, purchases: 1648 },
    { sku: "SKU-PAD-004", name: "4th GEN. Outdoor Smart Padlock", views: 24560, clicks: 6890, addToCart: 1490, purchases: 812 },
    { sku: "SKU-LOTO-RED", name: "Smart Lockout Tagout Lock (RED)", views: 11230, clicks: 2980, addToCart: 640, purchases: 301 },
    { sku: "SKU-SHACKLE-001", name: "Smart Padlock Replacement Shackle", views: 7620, clicks: 1510, addToCart: 410, purchases: 188 },
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
    {month: "Oct", total: 6120, added: 180 },
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
