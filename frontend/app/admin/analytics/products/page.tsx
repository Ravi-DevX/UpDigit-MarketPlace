"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fetchAdminTopProducts } from "@/lib/api";
import type { ProductSalesStat } from "@/types/marketplace";
import {
  EmptyState,
  ErrorState,
  formatMoney,
  formatNumber,
  LoadingState,
  PageHeader,
} from "@/app/admin/_components/AdminUI";

export default function AdminAnalyticsProducts() {
  const [products, setProducts] = useState<ProductSalesStat[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let mounted = true;
    fetchAdminTopProducts(10)
      .then((payload) => {
        if (mounted) {
          setProducts(payload);
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

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Product analytics"
        title="Top products"
        description="Rank completed-order revenue and order volume by product."
      />

      {state === "error" ? <ErrorState message="Top products could not load." /> : null}
      {state === "loading" ? <LoadingState label="Loading top products..." /> : null}
      {state === "ready" && products.length === 0 ? <EmptyState title="No product revenue yet" description="Completed orders are required before this chart has data." /> : null}

      {state === "ready" && products.length > 0 ? (
        <>
          <article className="h-[340px] rounded-2xl border border-border bg-surface p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={products}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="title" tick={{ fill: "#a1a1aa", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(value) => `$${value}`} tick={{ fill: "#a1a1aa", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "#0d1017", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12 }}
                  formatter={(value) => formatMoney(Number(value))}
                />
                <Bar dataKey="revenue" fill="var(--accent)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </article>

          <div className="overflow-hidden rounded-2xl border border-border bg-surface">
            <div className="grid grid-cols-[1.2fr_0.7fr_0.6fr_0.8fr] gap-3 border-b border-border px-4 py-3 text-xs uppercase tracking-[0.12em] text-textSecondary max-md:hidden">
              <span>Product</span>
              <span>Seller</span>
              <span>Orders</span>
              <span>Revenue</span>
            </div>
            <div className="divide-y divide-white/10">
              {products.map((product) => (
                <div key={product.id} className="grid gap-3 px-4 py-4 md:grid-cols-[1.2fr_0.7fr_0.6fr_0.8fr] md:items-center">
                  <span className="text-sm font-medium text-textPrimary">{product.title}</span>
                  <span className="text-sm text-textSecondary">@{product.seller_username}</span>
                  <span className="text-sm text-textSecondary">{formatNumber(product.orders_completed)}</span>
                  <span className="text-sm text-textPrimary">{formatMoney(product.revenue)}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
