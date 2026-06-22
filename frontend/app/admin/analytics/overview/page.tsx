"use client";

import { useEffect, useState } from "react";
import { fetchPlatformStats } from "@/lib/api";
import type { StatsPayload } from "@/types/marketplace";
import {
  EmptyState,
  ErrorState,
  formatMoney,
  formatNumber,
  LoadingState,
  PageHeader,
} from "@/app/admin/_components/AdminUI";

export default function AdminAnalyticsOverview() {
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let mounted = true;
    fetchPlatformStats()
      .then((payload) => {
        if (mounted) {
          setStats(payload);
          setState("ready");
        }
      })
      .catch(() => {
        if (mounted) {
          setState("error");
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const cards = [
    ["Total users", formatNumber(stats?.total_users)],
    ["New users today", formatNumber(stats?.new_users_today)],
    ["Total products", formatNumber(stats?.total_products)],
    ["Pending products", formatNumber(stats?.pending_products)],
    ["Total orders", formatNumber(stats?.total_orders)],
    ["Completed orders", formatNumber(stats?.completed_orders)],
    ["Total revenue", formatMoney(stats?.total_revenue)],
    ["Revenue today", formatMoney(stats?.revenue_today)],
    ["Unique buyers today", formatNumber(stats?.unique_buyers_today)],
    ["Active sellers", formatNumber(stats?.active_sellers)],
  ];

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Analytics overview"
        title="Platform health"
        description="Live aggregate metrics from users, products, orders, revenue, buyers, and seller activity."
      />

      {state === "error" ? <ErrorState message="Analytics overview could not load." /> : null}
      {state === "loading" ? <LoadingState label="Loading analytics overview..." /> : null}
      {state === "ready" && !stats ? <EmptyState title="No analytics returned" description="The overview endpoint did not return data." /> : null}

      {state === "ready" && stats ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {cards.map(([label, value]) => (
            <article key={label} className="rounded-2xl border border-border bg-surface p-5">
              <p className="text-xs text-textSecondary">{label}</p>
              <p className="mt-3 text-2xl font-semibold text-textPrimary">{value}</p>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
