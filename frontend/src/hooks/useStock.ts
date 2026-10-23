import { useEffect, useState } from "react";
import api from "../api/client";
import type { StockItem } from "../views/StockAvailable";

// One shared in-flight/settled fetch so the sidebar badge and the Stock page
// don't each hit the endpoint. Call refreshStock() to force a re-fetch.
let cache: Promise<StockItem[]> | null = null;

function load(): Promise<StockItem[]> {
  if (!cache) {
    cache = api
      .get<{ rows: StockItem[] }>("/health/stocks", { timeout: 30000 })
      // Postgres sends numeric columns as text — make them numbers so they
      // sort and add up instead of joining as strings.
      .then((r) =>
        r.data.rows.map((row) => ({
          ...row,
          available: Number(row.available) || 0,
          inbound: Number(row.inbound) || 0,
          total_units: Number(row.total_units) || 0,
        })),
      )
      .catch((err) => {
        cache = null; // let the next mount retry
        throw err;
      });
  }
  return cache;
}

export function refreshStock(): void {
  cache = null;
}

interface UseStock {
  rows: StockItem[];
  lowItems: StockItem[];
  loading: boolean;
  error: string;
  reload: () => void;
}

// `enabled: false` skips the fetch entirely — for callers (like the sidebar
// badge) that render on every page, including ones a viewer without stock
// access can't reach; no point 403ing on their behalf.
export function useStock(enabled: boolean = true): UseStock {
  const [data, setData] = useState<StockItem[] | null>(null);
  const [error, setError] = useState("");
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setError("");
    load()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load stock levels.");
      });
    return () => {
      cancelled = true;
    };
  }, [nonce, enabled]);

  const rows = data ?? [];
  // Amazon only fills in the alert (status) for SKUs that need attention.
  const lowItems = rows.filter((i) => !!i.status);

  return {
    rows,
    lowItems,
    loading: !data && !error,
    error,
    reload: () => {
      refreshStock();
      setNonce((n) => n + 1);
    },
  };
}
