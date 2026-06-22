"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  CircleDollarSign,
  Clock3,
  Eye,
  PackagePlus,
  ShoppingCart,
  Star,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  fetchSellerAnalytics,
  fetchSellerDashboard,
  fetchSellerDashboardProducts,
  fetchSellerEarnings,
  fetchSellerOrders,
} from "@/lib/api";
import type { Order, Product, SellerAnalyticsPayload, SellerDashboardPayload, SellerEarningsPayload } from "@/types/marketplace";
import { BadgeDelta } from "@/components/ui/badge-delta";
import { Badge as StatusBadge } from "@/components/ui/cvui-badge";

function money(value: number | undefined) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function compact(value: number | undefined) {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value || 0);
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

function trend(current: number, previous: number) {
  if (previous <= 0) return current > 0 ? { type: "increase" as const, value: "New" } : { type: "neutral" as const, value: "0%" };
  const change = ((current - previous) / previous) * 100;
  return { type: change > 0 ? "increase" as const : change < 0 ? "decrease" as const : "neutral" as const, value: `${Math.abs(change).toFixed(1)}%` };
}

export default function SellerDashboardPage() {
  const [dashboard, setDashboard] = useState<SellerDashboardPayload | null>(null);
  const [analytics, setAnalytics] = useState<SellerAnalyticsPayload | null>(null);
  const [earnings, setEarnings] = useState<SellerEarningsPayload | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [dashboardData, analyticsData, earningsData, productData, orderData] = await Promise.all([
          fetchSellerDashboard(),
          fetchSellerAnalytics(),
          fetchSellerEarnings(),
          fetchSellerDashboardProducts(),
          fetchSellerOrders(),
        ]);
        if (!mounted) {
          return;
        }
        setDashboard(dashboardData);
        setAnalytics(analyticsData);
        setEarnings(earningsData);
        setProducts(productData);
        setOrders(orderData);
      } catch {
        if (mounted) {
          setError("Seller dashboard could not load. Sign in as a seller or apply for seller access.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const chartData = useMemo(() => {
    const fromApi = analytics?.series?.map((point) => ({
      period: dateLabel(point.period),
      revenue: point.revenue,
      orders: point.orders,
    }));
    if (fromApi && fromApi.length > 0) {
      return fromApi;
    }
    return Array.from({ length: 7 }, (_, index) => ({
      period: dateLabel(new Date(Date.now() - (6 - index) * 86400000).toISOString()),
      revenue: 0,
      orders: 0,
    }));
  }, [analytics]);

  const topProducts = useMemo(
    () => [...products].sort((a, b) => (b.total_sales || 0) - (a.total_sales || 0)).slice(0, 5),
    [products],
  );
  const series = analytics?.series ?? [];
  const latestPeriod = series.at(-1);
  const previousPeriod = series.at(-2);
  const revenueTrend = trend(latestPeriod?.revenue ?? 0, previousPeriod?.revenue ?? 0);
  const orderTrend = trend(latestPeriod?.orders ?? 0, previousPeriod?.orders ?? 0);
  const conversionSignals = [
    {
      label: "Products",
      value: compact(dashboard?.products ?? products.length),
      detail: `${products.filter((product) => product.status === "approved").length} approved`,
      icon: Boxes,
      delta: { type: "neutral" as const, value: "Live" },
    },
    {
      label: "Orders",
      value: compact(dashboard?.orders ?? orders.length),
      detail: `${dashboard?.completed_orders ?? orders.filter((order) => order.status === "completed").length} completed`,
      icon: ShoppingCart,
      delta: orderTrend,
    },
    {
      label: "Revenue",
      value: money(analytics?.revenue ?? dashboard?.revenue),
      detail: `${money(earnings?.balance)} available`,
      icon: CircleDollarSign,
      delta: revenueTrend,
    },
    {
      label: "Downloads",
      value: compact(products.reduce((sum, product) => sum + (product.total_downloads || 0), 0)),
      detail: "Across listings",
      icon: TrendingUp,
      delta: { type: "neutral" as const, value: "Live" },
    },
  ];

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-primary">Overview</p>
          <h2 className="mt-2 text-2xl font-semibold text-textPrimary">Seller dashboard</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-textSecondary">
            Track revenue, listings, orders, uploads, and the next actions needed to keep the store launch-ready.
          </p>
        </div>
        <Link
          href="/seller/products/new"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-[0_18px_50px_rgba(99,102,241,0.25)]"
        >
          <PackagePlus className="size-4" />
          New product
        </Link>
      </div>

      {error ? (
        <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {conversionSignals.map(({ label, value, detail, icon: Icon, delta }) => (
          <article key={label} className="rounded-2xl border border-border bg-surface p-5">
            <div className="mb-6 flex items-center justify-between">
              <Icon className="size-5 text-primary" />
              <BadgeDelta variant="solidOutline" deltaType={delta.type} iconStyle="line" value={loading ? "Sync" : delta.value} />
            </div>
            <p className="text-3xl font-semibold text-textPrimary">{loading ? "..." : value}</p>
            <p className="mt-1 text-sm text-textSecondary">{label}</p>
            <p className="mt-4 text-xs text-textSecondary">{detail}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.45fr_0.85fr]">
        <article className="rounded-2xl border border-border bg-surface p-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-textPrimary">Revenue pulse</h3>
              <p className="mt-1 text-sm text-textSecondary">Completed seller earnings by day.</p>
            </div>
            <Link href="/seller/earnings" className="inline-flex items-center gap-1 text-sm text-primary">
              Earnings <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="sellerRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="period" tickLine={false} axisLine={false} stroke="var(--text-secondary)" fontSize={12} />
                <YAxis tickLine={false} axisLine={false} stroke="var(--text-secondary)" fontSize={12} tickFormatter={(value) => `$${value}`} />
                <Tooltip
                  contentStyle={{
                    background: "var(--bg-elevated)",
                    border: "var(--border-width) solid var(--border)",
                    borderRadius: "var(--radius-lg)",
                    color: "var(--text-primary)",
                  }}
                />
                <Area type="monotone" dataKey="revenue" stroke="var(--accent)" fill="url(#sellerRevenue)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="rounded-2xl border border-border bg-surface p-5">
          <h3 className="text-base font-semibold text-textPrimary">Launch checklist</h3>
          <div className="mt-5 space-y-3">
            {[
              {
                label: "Add product files",
                done: products.some((product) => (product.version_count || 0) > 0),
              },
              {
                label: "Publish at least 3 listings",
                done: products.length >= 3,
              },
              {
                label: "Complete store settings",
                done: false,
              },
              {
                label: "Create first coupon",
                done: false,
              },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-xl border border-border bg-elevated px-4 py-3">
                <span className="text-sm text-textSecondary">{item.label}</span>
                <StatusBadge label={item.done ? "Done" : "Open"} variant={item.done ? "success" : "warning"} appearance="subtle" size="small" />
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-border bg-surface p-5">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-base font-semibold text-textPrimary">Top listings</h3>
            <Link href="/seller/products" className="text-sm text-primary">Manage</Link>
          </div>
          <div className="space-y-3">
            {topProducts.length === 0 ? (
              <p className="rounded-xl border border-border bg-elevated p-4 text-sm text-textSecondary">
                No products yet. Publish your first listing to unlock product analytics.
              </p>
            ) : (
              topProducts.map((product) => (
                <Link
                  key={product.id}
                  href={`/products/${product.slug}`}
                  className="grid grid-cols-[48px_1fr_auto] items-center gap-3 rounded-xl border border-border bg-elevated p-3 transition hover:border-primary/35"
                >
                  <img src={product.thumbnail_url || "/placeholder-product.png"} alt="" className="size-12 rounded-xl object-cover" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-textPrimary">{product.title}</span>
                    <span className="mt-1 flex items-center gap-3 text-xs text-textSecondary">
                      <span className="inline-flex items-center gap-1"><Eye className="size-3" /> {compact(product.total_downloads)}</span>
                      <span className="inline-flex items-center gap-1"><Star className="size-3" /> {product.average_rating.toFixed(1)}</span>
                    </span>
                  </span>
                  <span className="text-sm font-semibold text-textPrimary">${product.price.toFixed(2)}</span>
                </Link>
              ))
            )}
          </div>
        </article>

        <article className="rounded-2xl border border-border bg-surface p-5">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-base font-semibold text-textPrimary">Recent orders</h3>
            <Link href="/seller/orders" className="text-sm text-primary">View all</Link>
          </div>
          <div className="space-y-3">
            {orders.length === 0 ? (
              <p className="rounded-xl border border-border bg-elevated p-4 text-sm text-textSecondary">
                No orders yet.
              </p>
            ) : (
              orders.slice(0, 5).map((order) => (
                <div key={order.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-elevated p-3">
                  <span>
                    <span className="block text-sm font-medium text-textPrimary">{order.id.slice(0, 8)}</span>
                    <span className="mt-1 inline-flex items-center gap-1 text-xs text-textSecondary">
                      <Clock3 className="size-3" />
                      {dateLabel(order.created_at)}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block text-sm font-semibold text-textPrimary">{money(order.seller_earnings)}</span>
                    <span className="mt-1 block"><StatusBadge label={order.status} variant={order.status === "completed" ? "success" : order.status === "refunded" ? "error" : "warning"} appearance="subtle" size="small" /></span>
                  </span>
                </div>
              ))
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
