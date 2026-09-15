import { useEffect, useState } from "react";
import api from "../api/client";
import type { StockAvailableData, StockItem } from "../types";

// One shared in-flight/settled fetch so the sidebar badge and the Stock page
// don't each hit the endpoint. Call refreshStock() to force a re-fetch.
let cache: Promise<StockAvailableData> | null = null;

function load(): Promise<StockAvailableData> {
  if (!cache) {
    cache = api
      .get<StockAvailableData>("/dashboard/stock-available")
      .then((r) => r.data)
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
  data: StockAvailableData | null;
  lowItems: StockItem[];
  loading: boolean;
  error: string;
  reload: () => void;
}

// `enabled: false` skips the fetch entirely — for callers (like the sidebar
// badge) that render on every page, including ones a viewer without stock
// access can't reach; no point 403ing on their behalf.
export function useStock(enabled: boolean = true): UseStock {
  const [data, setData] = useState<StockAvailableData | null>(null);
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

  const lowItems = (data?.byItem ?? []).filter((i) => i.status !== "ok");

  return {
    data,
    lowItems,
    loading: !data && !error,
    error,
    reload: () => {
      refreshStock();
      setNonce((n) => n + 1);
    },
  };
}
