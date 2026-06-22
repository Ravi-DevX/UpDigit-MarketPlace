"use client";

import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CircleDollarSign, Send } from "lucide-react";
import { fetchSellerAnalytics, fetchSellerEarnings, fetchSellerOrders } from "@/lib/api";
import type { Order, SellerAnalyticsPayload, SellerEarningsPayload } from "@/types/marketplace";

function money(value: number | undefined) {
  return new Intl.NumberFormat("en", { style: "currency", currency: "USD" }).format(value || 0);
}

function label(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

export default function SellerEarningsPage() {
  const [earnings, setEarnings] = useState<SellerEarningsPayload | null>(null);
  const [analytics, setAnalytics] = useState<SellerAnalyticsPayload | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    Promise.all([fetchSellerEarnings(), fetchSellerAnalytics(), fetchSellerOrders()])
      .then(([earningsData, analyticsData, orderData]) => {
        if (!mounted) {
          return;
        }
        setEarnings(earningsData);
        setAnalytics(analyticsData);
        setOrders(orderData);
      })
      .catch(() => {
        if (mounted) {
          setError("Could not load earnings.");
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const chartData = useMemo(() => {
    if (analytics?.series?.length) {
      return analytics.series.map((point) => ({ period: label(point.period), revenue: point.revenue }));
    }
    return Array.from({ length: 7 }, (_, index) => ({
      period: label(new Date(Date.now() - (6 - index) * 86400000).toISOString()),
      revenue: 0,
    }));
  }, [analytics]);

  const completed = orders.filter((order) => order.status === "completed");
  const pending = orders.filter((order) => order.status !== "completed");

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-primary">Money</p>
        <h2 className="mt-2 text-2xl font-semibold text-textPrimary">Earnings</h2>
        <p className="mt-2 text-sm text-textSecondary">Monitor available balance, completed revenue, payout readiness, and order earnings.</p>
      </div>
      {error ? <div className="rounded-2xl border border-danger/50 bg-danger/10 p-3 text-sm text-danger">{error}</div> : null}
      <div className="grid gap-4 md:grid-cols-3">
        {[
          ["Available balance", money(earnings?.balance), "Ready for payout"],
          ["Completed revenue", money(analytics?.revenue), `${completed.length} completed orders`],
          ["Pending orders", String(pending.length), "Awaiting completion"],
        ].map(([title, value, detail]) => (
          <article key={title} className="rounded-2xl border border-border bg-surface p-5">
            <CircleDollarSign className="mb-6 size-5 text-primary" />
            <p className="text-3xl font-semibold text-textPrimary">{value}</p>
            <p className="mt-1 text-sm text-textSecondary">{title}</p>
            <p className="mt-4 text-xs text-textSecondary">{detail}</p>
          </article>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_0.55fr]">
        <article className="rounded-2xl border border-border bg-surface p-5">
          <h3 className="text-base font-semibold text-textPrimary">Revenue over time</h3>
          <div className="mt-5 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="period" tickLine={false} axisLine={false} stroke="var(--text-secondary)" fontSize={12} />
                <YAxis tickLine={false} axisLine={false} stroke="var(--text-secondary)" fontSize={12} />
                <Tooltip contentStyle={{ background: "var(--bg-elevated)", border: "var(--border-width) solid var(--border)", borderRadius: "var(--radius-lg)", color: "var(--text-primary)" }} />
                <Area dataKey="revenue" type="monotone" stroke="var(--accent)" fill="rgb(var(--accent-rgb) / 0.2)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>
        <article className="rounded-2xl border border-border bg-surface p-5">
          <h3 className="text-base font-semibold text-textPrimary">Payout request</h3>
          <p className="mt-2 text-sm leading-6 text-textSecondary">Payout request endpoint exists. The next backend pass should validate payout method and expose payout history.</p>
          <button className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-surface px-4 py-3 text-sm text-textSecondary">
            <Send className="size-4" />
            Request payout
          </button>
        </article>
      </div>
    </section>
  );
}
