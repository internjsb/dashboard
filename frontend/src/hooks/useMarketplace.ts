import { useSyncExternalStore } from "react";

// Amazon marketplace ID -> country. `code` is the marketplace_id the backend
// returns on every table row. IDs aren't all the same length (US, Italy and
// Belgium are 13 characters) — that's how Amazon issues them.
export interface Marketplace {
  code: string;
  country: string;
  label: string;
}

export const MARKETPLACES: Marketplace[] = [

  { code: "A13V1IB3VIYZZH", country: "FR", label: "France" },
  { code: "A17E79C6D8DWNP", country: "SA", label: "Saudi Arabia" },
  { code: "A1805IZSGTT6HS", country: "NL", label: "Netherlands" },
  { code: "A1AM78C64UM0Y8", country: "MX", label: "Mexico" },
  { code: "A1C3SOZRARQ6R3", country: "PL", label: "Poland" },
  { code: "A1F83G8C2ARO7P", country: "GB", label: "United Kingdom" },
  { code: "A1PA6795UKMFR9", country: "DE", label: "Germany" },
  { code: "A1RKKUPIHCS9HS", country: "ES", label: "Spain" },
  { code: "A1VC38T7YXB528", country: "JP", label: "Japan" },
  { code: "A28R8C7NBKEWEA", country: "IE", label: "Ireland" },
  { code: "A2EUQ1WTGCTBG2", country: "CA", label: "Canada" },
  { code: "A2NODRKZP88ZB9", country: "SE", label: "Sweden" },
  { code: "A2Q3Y263D00KWC", country: "BR", label: "Brazil" },
  { code: "A2VIGQ35RCS4UG", country: "AE", label: "UAE" },
  { code: "A33AVAJ2PDY3EV", country: "TR", label: "Turkey" },
  { code: "A39IBJ37TRP1C6", country: "AU", label: "Australia" },
  { code: "AMEN7PMS3EDWL", country: "BE", label: "Belgium" }, //idk why but this code only have 13 words while every code has 14 words
  { code: "APJ6JRA9NG5V4", country: "IT", label: "Italy" },   // this also
  { code: "ATVPDKIKX0DER", country: "US",  label: "United States" }, //and this
];

// Shared selection ("" = all marketplaces), same idea as useSidebar.
let selected = localStorage.getItem("marketplace") ?? "";
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setMarketplace(code: string) {
  selected = code;
  localStorage.setItem("marketplace", code);
  listeners.forEach((l) => l());
}

export function useMarketplace() {
  const code = useSyncExternalStore(subscribe, () => selected);
  const marketplace = MARKETPLACES.find((m) => m.code === code) ?? null;
  return { code, marketplace, setMarketplace };
}

// Table filter: true when no marketplace is picked ("All marketplaces") or the
// row's marketplace_id is the picked one.
export function inMarketplace(code: string, rowMarketplaceId: string | null | undefined): boolean {
  return !code || rowMarketplaceId === code;
}
