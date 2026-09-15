import { useEffect, useMemo, useState } from "react";
import AppSidebar from "../components/AppSidebar";
import AppTopbar from "../components/AppTopbar";
import ProductHero from "../components/ProductHero";
import StatCard from "../components/StatCard";
import RevenueChart from "../components/RevenueChart";
import SalesByFinishDonut from "../components/SalesByFinishDonut";
import VariantCards from "../components/VariantCards";
import RecentOrders from "../components/RecentOrders";
import SegmentSearchBar from "../components/SegmentSearchBar";
import api from "../api/client";
import { matches } from "../utils/search";
import type { DashboardOverview } from "../types";
import styles from "./Dashboard.module.css";

const EMPTY_OVERVIEW: DashboardOverview = {
  product: { name: "", asin: "", price: 0, rating: 0, reviews: 0, stock: 0, unitsLifetime: 0 },
  stats: {},
  revenueTrend: [],
  salesByFinish: [],
  variants: [],
  variantsByPeriod: { daily: [], weekly: [], monthly: [], yearly: [] },
  recentOrders: [],
};

export default function Dashboard() {
  const [overview, setOverview] = useState<DashboardOverview>(EMPTY_OVERVIEW);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<DashboardOverview>("/dashboard/overview");
        if (!cancelled) setOverview(data);
      } catch (err) {
        if (!cancelled) setError("Couldn't load dashboard data. Is the backend running?");
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const isSearching = query.trim().length > 0;

  // Only the KPI tiles get filtered individually ("units sold" -> just that
  // tile). The bigger sections below are matched as a whole ("sales by
  // finish" -> the whole segment, chart or cards).
  const matchedStats = useMemo(
    () => Object.entries(overview.stats).filter(([, stat]) => matches(stat.label, query)),
    [overview.stats, query],
  );

  // Keep this to the section's own name/synonyms — not words that merely
  // appear somewhere in its data (e.g. an order status like "returned"),
  // or searching "return" would wrongly pull in Recent Orders.
  const sectionText = {
    hero: `${overview.product.name} ${overview.product.asin}`,
    revenue: "revenue trend",
    finishDonut: "sales by finish",
    variantCards: "sales by finish variant cards",
    recentOrders: "recent orders",
  };

  const show = {
    hero: !isSearching || matches(sectionText.hero, query),
    revenue: !isSearching || matches(sectionText.revenue, query),
    finishDonut: !isSearching || matches(sectionText.finishDonut, query),
    variantCards: !isSearching || matches(sectionText.variantCards, query),
    recentOrders: !isSearching || matches(sectionText.recentOrders, query),
  };

  const nothingFound =
    isSearching &&
    matchedStats.length === 0 &&
    !show.hero &&
    !show.revenue &&
    !show.finishDonut &&
    !show.variantCards &&
    !show.recentOrders;

  return (
    <div className="app-shell">
      <AppSidebar />
      <div className="app-content">
        <AppTopbar title="Sales overview" />
        <main className={styles.content}>
          <SegmentSearchBar
            value={query}
            onChange={setQuery}
            placeholder="Search the dashboard....."
          />

          {loading ? (
            <p className={styles.state}>Loading…</p>
          ) : error ? (
            <p className={`${styles.state} ${styles.error}`}>{error}</p>
          ) : nothingFound ? (
            <p className={styles.state}>No dashboard cards match “{query}”.</p>
          ) : (
            <>
              {show.hero && (
                <section className={styles.block}>
                  <ProductHero product={overview.product} />
                </section>
              )}

              {matchedStats.length > 0 && (
                <section className={styles.statsGrid}>
                  {matchedStats.map(([key, stat], i) => (
                    <StatCard key={key} {...stat} featured={!isSearching && i === 0} />
                  ))}
                </section>
              )}

              {isSearching ? (
                <>
                  {show.revenue && (
                    <section className={styles.block}>
                      <RevenueChart data={overview.revenueTrend} />
                    </section>
                  )}
                  {show.finishDonut && (
                    <section className={styles.block}>
                      <SalesByFinishDonut variantsByPeriod={overview.variantsByPeriod} />
                    </section>
                  )}
                </>
              ) : (
                (show.revenue || show.finishDonut) && (
                  <section className={styles.chartGrid}>
                    {show.revenue && <RevenueChart data={overview.revenueTrend} />}
                    {show.finishDonut && <SalesByFinishDonut variantsByPeriod={overview.variantsByPeriod} />}
                  </section>
                )
              )}

              {show.variantCards && (
                <section className={styles.block}>
                  <VariantCards variantsByPeriod={overview.variantsByPeriod} />
                </section>
              )}

              {show.recentOrders && (
                <section className={styles.block}>
                  <RecentOrders orders={overview.recentOrders} />
                </section>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
