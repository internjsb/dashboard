// Turning audit-log entries into readable text — shared by the Audit log page
// and the "User details" pop-up on Manage users.
import type { AuditEvent } from "../types";

export const ACTION_LABEL: Record<string, string> = {
  "auth.login": "Signed in",
  "auth.signup": "Registered",
  "profile.update": "Updated profile",
  "user.approve": "Approved user",
  "user.deny": "Denied user",
  "user.role_change": "Changed role",
  "user.disable": "Disabled account",
  "user.enable": "Enabled account",
  "user.remove": "Removed user",
  "user.remove_orphan": "Removed orphaned request",
  "user.department_change": "Changed department",
  "user.create": "Added user manually",
  "user.page_access_change": "Changed page access",
  "product.create": "Added product",
  "product.update": "Edited product",
  "product.delete": "Deleted product",
  "listing.create": "Added listing",
  "listing.update": "Edited listing",
  "listing.delete": "Deleted listing",
  "listing.hide_amazon": "Removed Amazon listing from page",
  "listing.update_amazon": "Edited Amazon listing",
  "sale_report.update": "Edited sales report row",
  "sale_report.delete": "Deleted sales report row",
};

export function label(action: string): string {
  return ACTION_LABEL[action] ?? action;
}

export type Detail = Record<string, unknown> | null | undefined;

export function str(d: Detail, key: string): string | null {
  const v = d?.[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

// "alice@example.com" -> "alice". Leaves anything without an "@" untouched.
export function username(value: string | null | undefined): string | null {
  if (!value) return null;
  const at = value.indexOf("@");
  return at > 0 ? value.slice(0, at) : value;
}

export const ROLE_NAME: Record<string, string> = {
  admin: "an admin",
  user: "a standard user",
};

export const DEPARTMENT_NAME: Record<string, string> = {
  super_user: "Super user",
  sales: "Sales",
  supplychain: "Supply chain",
  finance: "Finance",
};

// A plain-English sentence describing exactly what happened, using the event's
// stored detail. Falls back to the short action label when detail is missing.
export function describe(e: AuditEvent): string {
  const d = e.detail;
  const who = username(str(d, "email")) || str(d, "targetUid") || "this person";

  switch (e.action) {
    case "auth.login":
      return "Signed in";
    case "auth.signup": {
      const name = username(str(d, "email")) || "a new account";
      const status = str(d, "status");
      return status === "active"
        ? `Registered ${name} (auto-approved)`
        : `Registered ${name} (awaiting approval)`;
    }
    case "user.approve": {
      const dept = str(d, "department");
      return dept
        ? `Approved ${who} for access (${DEPARTMENT_NAME[dept] || dept})`
        : `Approved ${who} for access`;
    }
    case "user.create":
      return `Added ${who} manually`;
    case "user.deny":
      return `Denied ${who} access`;
    case "user.disable":
      return `Disabled ${who}'s account`;
    case "user.enable":
      return `Re-enabled ${who}'s account`;
    case "user.remove":
      return `Removed ${who}'s account`;
    case "user.remove_orphan":
      return `Removed ${who}'s orphaned request`;
    case "user.role_change": {
      const role = str(d, "role") || "";
      if (e.aboutYou) return role === "admin" ? "You were made an admin" : "Your admin access was revoked";
      return `Changed ${who} to ${ROLE_NAME[role] || `"${role}"`}`;
    }
    case "user.department_change": {
      const dept = str(d, "department");
      return dept ? `Set ${who}'s department to ${DEPARTMENT_NAME[dept] || dept}` : `Cleared ${who}'s department`;
    }
    default:
      return label(e.action);
  }
}

export function deviceFromUA(ua: string): string {
  if (!ua || ua === "unknown") return "Unknown";

  // Check mobile FIRST — an iPhone's UA also contains "like Mac OS X".
  let device: string;
  if (/iPhone/.test(ua)) device = "iPhone";
  else if (/iPad/.test(ua)) device = "iPad";
  else if (/Android/.test(ua)) device = /Mobile/.test(ua) ? "Android phone" : "Android tablet";
  else if (/CrOS/.test(ua)) device = "Chromebook";
  else if (/Macintosh|Mac OS X/.test(ua)) device = "MacBook";
  else if (/Windows NT/.test(ua)) device = "Windows PC";
  else if (/Linux/.test(ua)) device = "Linux PC";
  else device = "Unknown device";

  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /Firefox\/|FxiOS/.test(ua)
        ? "Firefox"
        : /CriOS/.test(ua) || (/Chrome\//.test(ua) && !/Chromium/.test(ua))
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "browser";

  return `${browser} · ${device}`;
}

// Which page each kind of action happens on. Matched by action prefix first,
// then by exact action for the few that live on a different screen.
export const PAGE_BY_ACTION: Record<string, string> = {
  "auth.login": "Sign in",
  "auth.signup": "Register",
  "profile.update": "Profile",
  "user.page_access_change": "User page management",
};
export const PAGE_BY_PREFIX: Record<string, string> = {
  listing: "Product Listing",
  product: "AMAZON Listing",
  sale_report: "Sales report",
  user: "Manage users",
};

export const PAGE_NAME: Record<string, string> = {
  dashboard: "Dashboard",
  sales_history: "Sales history",
  stock_available: "Stock availability",
  inventory: "Inventory",
  finance: "Finance",
  products: "AMAZON Listing",
  product_listings: "Product Listing",
  sale_report: "Sales report",
};

// Readable names for the fields an edit can change (see diffFields in the backend).
export const FIELD_LABEL: Record<string, string> = {
  division: "Division",
  dtiItemCode: "DTI item",
  dtiItemDescription: "DTI Item Description",
  dtiItemCode2: "2nd DTI item",
  dtiItemDescription2: "2nd DTI Item Description",
  type: "Type",
  ean: "EAN",
  sn: "S/N",
  sku: "SKU",
  set: "Set",
  country: "Country",
  asin: "ASIN",
  fnsku: "FNSKU",
  description: "Description",
  status: "Status",
  category: "Category",
  itemCode: "Item code",
  qty: "QTY",
  productSalesPrice: "Product sales price",
  orderId: "Order id",
  shippedDate: "Shipped date",
};

export const IMAGE_CHANGE_LABEL: Record<string, string> = {
  added: "Photo added",
  replaced: "Photo changed",
  removed: "Photo removed",
};

// Fields recorded by the backend but not shown in Details, per page prefix.
export const HIDDEN_CHANGE_FIELDS: Record<string, Set<string>> = {
  listing: new Set(["type"]),
};

export interface FieldChange {
  field: string;
  from: unknown;
  to: unknown;
}

// One line per thing an edit changed: "Division: DWL → LOCK", "Photo removed".
// Entries recorded before change tracking existed return [].
export function changesOf(e: AuditEvent): string[] {
  const d = e.detail;
  const lines: string[] = [];
  const shown = (v: unknown) => (v === "" || v == null ? "(blank)" : String(v));
  const hidden = HIDDEN_CHANGE_FIELDS[e.action.split(".")[0]];
  const changes = (Array.isArray(d?.changes) ? (d!.changes as FieldChange[]) : []).filter(
    (c) => !hidden?.has(c.field),
  );
  for (const c of changes) lines.push(`${FIELD_LABEL[c.field] || c.field}: ${shown(c.from)} → ${shown(c.to)}`);
  const img = str(d, "imageChange"); // single-photo entries (older)
  if (img) lines.push(IMAGE_CHANGE_LABEL[img] || `Photo ${img}`);
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const added = typeof d?.photosAdded === "number" ? d.photosAdded : 0;
  const removed = typeof d?.photosRemoved === "number" ? d.photosRemoved : 0;
  if (added) lines.push(`${plural(added, "photo")} added`);
  if (removed) lines.push(`${plural(removed, "photo")} removed`);
  if (d?.photosReordered === true) lines.push("Cover photo / order changed");
  if (e.action === "listing.create" && typeof d?.photos === "number" && d.photos > 0) {
    lines.push(`${plural(d.photos, "photo")} uploaded`);
  }
  const photoLines = added || removed || d?.photosReordered === true;
  // Only when nothing changed at all — not when the only changes were hidden fields.
  if (Array.isArray(d?.changes) && d!.changes.length === 0 && !img && !photoLines) lines.push("Saved with no changes");
  return lines;
}

export function pageOf(action: string): string {
  return PAGE_BY_ACTION[action] ?? PAGE_BY_PREFIX[action.split(".")[0]] ?? "—";
}

// The specific thing the action touched, pulled from the stored detail.
export function subjectOf(e: AuditEvent): string | null {
  const d = e.detail;
  const join = (...parts: (string | null)[]) => parts.filter(Boolean).join(" · ") || null;
  const [prefix] = e.action.split(".");
  switch (prefix) {
    case "listing": {
      // No. = the row's position in the listing table at the time; older
      // entries didn't record it, so they fall back to the DTI item.
      const no = typeof d?.rowNo === "number" ? `No. ${d.rowNo}` : null;
      return no ?? (str(d, "dtiItemCode") && `DTI item ${str(d, "dtiItemCode")}`);
    }
    case "product":
      return join(str(d, "sku") && `SKU ${str(d, "sku")}`, str(d, "dtiItemDescription"));
    case "sale_report":
      return join(str(d, "orderId") && `Order ${str(d, "orderId")}`, str(d, "itemCode"));
    case "user": {
      const who = str(d, "email");
      if (e.action === "user.page_access_change") {
        const page = str(d, "page");
        const allowed = d?.allowed === true ? "granted" : d?.allowed === false ? "revoked" : null;
        return join(who, page && `${PAGE_NAME[page] || page}${allowed ? ` ${allowed}` : ""}`);
      }
      return who;
    }
    case "profile":
      return str(d, "displayName") && `Name: ${str(d, "displayName")}`;
    default:
      return null;
  }
}

export const countryNames = (() => {
  try {
    return new Intl.DisplayNames(undefined, { type: "region" });
  } catch {
    return null;
  }
})();

// "Singapore", "Kuala Lumpur, Malaysia", "Local network", or "—" for entries
// recorded before location tracking existed.
export function placeOf(e: Pick<AuditEvent, "location">): string {
  const loc = e.location;
  if (!loc) return "—";
  if (loc.local) return "Local network";
  const country = loc.country ? (countryNames?.of(loc.country) ?? loc.country) : null;
  const parts = [loc.city, country].filter(Boolean);
  return parts.length ? Array.from(new Set(parts)).join(", ") : "Unknown";
}

export function when(ts: number): { date: string; time: string; rel: string } {
  const d = new Date(ts);
  const date = d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const m = Math.round((Date.now() - ts) / 60000);
  let rel: string;
  if (m < 1) rel = "just now";
  else if (m < 60) rel = `${m}m ago`;
  else if (m < 1440) rel = `${Math.round(m / 60)}h ago`;
  else rel = `${Math.round(m / 1440)}d ago`;
  return { date, time, rel };
}
