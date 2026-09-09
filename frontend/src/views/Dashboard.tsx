import { useEffect, useState } from "react";
import AppSidebar from "../components/AppSidebar";
import AppTopbar from "../components/AppTopbar";
import ProductHero from "../components/ProductHero";
import StatCard from "../components/StatCard";
import RevenueChart from "../components/RevenueChart";
import CategoryDonut from "../components/CategoryDonut";
import VariantCards from "../components/VariantCards";
import RecentOrders from "../components/RecentOrders";
import api from "../api/client";
import type { DashboardOverview } from "../types";
import styles from "./Dashboard.module.css";

const EMPTY_OVERVIEW: DashboardOverview = {
  product: { name: "", asin: "", price: 0, rating: 0, reviews: 0, stock: 0, unitsLifetime: 0 },
  stats: {},
  revenueTrend: [],
  salesByFinish: [],
  variants: [],
  recentOrders: [],
};

export default function Dashboard() {
  const [overview, setOverview] = useState<DashboardOverview>(EMPTY_OVERVIEW);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  return (
    <div className={styles.layout}>
      <AppSidebar />
      <div className={styles.contentArea}>
        <AppTopbar title="Sales overview" />
        <main className={styles.content}>
          {loading ? (
            <p className={styles.state}>Loading…</p>
          ) : error ? (
            <p className={`${styles.state} ${styles.error}`}>{error}</p>
          ) : (
            <>
              <section className={styles.block}>
                <ProductHero product={overview.product} />
              </section>

              <section className={styles.statsGrid}>
                {Object.entries(overview.stats).map(([key, stat], i) => (
                  <StatCard key={key} {...stat} featured={i === 0} />
                ))}
              </section>

              <section className={styles.chartGrid}>
                <RevenueChart data={overview.revenueTrend} />
                <CategoryDonut
                  data={overview.salesByFinish}
                  title="Sales by finish"
                  subtitle="Revenue share · last 30 days"
                />
              </section>

              <section className={styles.block}>
                <VariantCards variants={overview.variants} />
              </section>

              <section className={styles.block}>
                <RecentOrders orders={overview.recentOrders} />
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
