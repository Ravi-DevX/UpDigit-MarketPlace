"use client";

import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fetchAdminRevenueSeries } from "@/lib/api";
import type { RevenuePoint } from "@/types/marketplace";
import {
  EmptyState,
  ErrorState,
  formatDate,
  formatMoney,
  formatNumber,
  LoadingState,
  PageHeader,
} from "@/app/admin/_components/AdminUI";

type GroupBy = "day" | "week" | "month";

export default function AdminAnalyticsRevenue() {
  const [series, setSeries] = useState<RevenuePoint[]>([]);
  const [groupBy, setGroupBy] = useState<GroupBy>("day");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let mounted = true;
    setState("loading");
    fetchAdminRevenueSeries({ group_by: groupBy })
      .then((payload) => {
        if (mounted) {
          setSeries([...payload].reverse());
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
  }, [groupBy]);

  const totals = useMemo(() => {
    return series.reduce(
      (acc, point) => {
        acc.amount += point.amount || 0;
        acc.count += point.count || 0;
        return acc;
      },
      { amount: 0, count: 0 },
    );
  }, [series]);

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Revenue analytics"
        title="Completed order revenue"
        description="Track gross completed order revenue over the selected period grouping."
        action={
          <select
            value={groupBy}
            onChange={(event) => setGroupBy(event.target.value as GroupBy)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-textPrimary outline-none"
          >
            <option value="day">Daily</option>
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
          </select>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <article className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-xs text-textSecondary">Revenue in range</p>
          <p className="mt-2 text-3xl font-semibold text-textPrimary">{formatMoney(totals.amount)}</p>
        </article>
        <article className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-xs text-textSecondary">Completed orders in range</p>
          <p className="mt-2 text-3xl font-semibold text-textPrimary">{formatNumber(totals.count)}</p>
        </article>
      </div>

      {state === "error" ? <ErrorState message="Revenue series could not load." /> : null}
      {state === "loading" ? <LoadingState label="Loading revenue chart..." /> : null}
      {state === "ready" && series.length === 0 ? <EmptyState title="No revenue data" description="No completed orders were returned for this period." /> : null}

      {state === "ready" && series.length > 0 ? (
        <article className="h-[360px] rounded-2xl border border-border bg-surface p-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series}>
              <defs>
                <linearGradient id="adminRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.7} />
                  <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="period" tickFormatter={formatDate} tick={{ fill: "#a1a1aa", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(value) => `$${value}`} tick={{ fill: "#a1a1aa", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "#0d1017", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12 }}
                labelFormatter={(label) => formatDate(String(label))}
                formatter={(value, name) => [name === "amount" ? formatMoney(Number(value)) : formatNumber(Number(value)), name]}
              />
              <Area type="monotone" dataKey="amount" stroke="var(--accent)" fill="url(#adminRevenue)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </article>
      ) : null}
    </section>
  );
}
