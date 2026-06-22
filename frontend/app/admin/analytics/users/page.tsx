"use client";

import { useEffect, useState } from "react";
import { fetchPlatformStats } from "@/lib/api";
import type { StatsPayload } from "@/types/marketplace";
import {
  EmptyState,
  ErrorState,
  formatNumber,
  LoadingState,
  PageHeader,
} from "@/app/admin/_components/AdminUI";

export default function AdminAnalyticsUsers() {
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
    ["Total users", formatNumber(stats?.total_users), "All DGEN-linked accounts in the marketplace."],
    ["New today", formatNumber(stats?.new_users_today), "Accounts created since UTC day start."],
    ["Unique buyers today", formatNumber(stats?.unique_buyers_today), "Distinct buyers with completed orders today."],
    ["Active sellers", formatNumber(stats?.active_sellers), "Approved creator shops."],
  ];

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="User analytics"
        title="Audience and seller activity"
        description="Track account growth, buyer activity, and approved seller supply."
      />

      {state === "error" ? <ErrorState message="User analytics could not load." /> : null}
      {state === "loading" ? <LoadingState label="Loading user analytics..." /> : null}
      {state === "ready" && !stats ? <EmptyState title="No user analytics returned" description="The overview endpoint did not return user metrics." /> : null}

      {state === "ready" && stats ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(([label, value, description]) => (
            <article key={label} className="rounded-2xl border border-border bg-surface p-5">
              <p className="text-xs text-textSecondary">{label}</p>
              <p className="mt-3 text-3xl font-semibold text-textPrimary">{value}</p>
              <p className="mt-4 text-sm leading-6 text-textSecondary">{description}</p>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
