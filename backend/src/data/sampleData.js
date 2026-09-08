// Placeholder data so the dashboard renders something meaningful immediately.
// Replace with real Realtime Database / Firestore reads once you have live data.

export const stats = {
  revenue: { label: "Revenue (MTD)", value: 48210, delta: 8.4, unit: "currency" },
  activeUsers: { label: "Active Users", value: 1284, delta: 3.1, unit: "count" },
  openTickets: { label: "Open Tickets", value: 27, delta: -12.5, unit: "count" },
  conversion: { label: "Conversion Rate", value: 4.7, delta: 0.6, unit: "percent" },
};

export const revenueTrend = [
  { month: "Mar", value: 31200 },
  { month: "Apr", value: 33800 },
  { month: "May", value: 35100 },
  { month: "Jun", value: 38950 },
  { month: "Jul", value: 41200 },
  { month: "Aug", value: 44600 },
  { month: "Sep", value: 48210 },
];

export const recentActivity = [
  { id: "a1", actor: "Mira Chen", action: "Approved invoice #4821", time: "10 min ago" },
  { id: "a2", actor: "System", action: "Nightly backup completed", time: "1 hr ago" },
  { id: "a3", actor: "Devon Wallace", action: "Signed up", time: "3 hr ago" },
  { id: "a4", actor: "Priya Nair", action: "Closed ticket #1042", time: "5 hr ago" },
  { id: "a5", actor: "System", action: "New signup: r.osei@example.com", time: "Yesterday" },
];

// Used by the seed script to create two sample logins.
export const sampleUsers = [
  { email: "admin@example.com", password: "Passw0rd!", role: "admin", displayName: "Alex Admin" },
  { email: "user@example.com", password: "Passw0rd!", role: "user", displayName: "Sam User" },
];
