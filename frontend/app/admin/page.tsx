"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Box,
  CircleDollarSign,
  Clock3,
  PackageCheck,
  ShieldAlert,
  ShoppingCart,
  Store,
  Users,
} from "lucide-react";
import { fetchAdminPayouts, fetchAdminReports, fetchPlatformStats } from "@/lib/api";
import type { PayoutRequest, Report, StatsPayload } from "@/types/marketplace";

function money(value?: number) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function number(value?: number) {
  return new Intl.NumberFormat("en").format(value || 0);
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "blocked">("loading");

  useEffect(() => {
    let mounted = true;
    Promise.all([fetchPlatformStats(), fetchAdminReports(), fetchAdminPayouts()])
      .then(([payload, reportItems, payoutItems]) => {
        if (!mounted) {
          return;
        }
        setStats(payload);
        setReports(reportItems);
        setPayouts(payoutItems);
        setStatus("ready");
      })
      .catch(() => {
        if (mounted) {
          setStatus("blocked");
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const cards = useMemo(
    () => [
      {
        label: "Total users",
        value: number(stats?.total_users),
        detail: `${number(stats?.new_users_today)} new today`,
        icon: Users,
        href: "/admin/users",
      },
      {
        label: "Products",
        value: number(stats?.total_products),
        detail: `${number(stats?.pending_products)} pending review`,
        icon: Box,
        href: "/admin/products",
      },
      {
        label: "Orders",
        value: number(stats?.total_orders),
        detail: `${number(stats?.completed_orders)} completed`,
        icon: ShoppingCart,
        href: "/admin/orders",
      },
      {
        label: "Revenue",
        value: money(stats?.total_revenue),
        detail: `${money(stats?.revenue_today)} today`,
        icon: CircleDollarSign,
        href: "/admin/analytics/revenue",
      },
      {
        label: "Active sellers",
        value: number(stats?.active_sellers),
        detail: "Approved creator shops",
        icon: Store,
        href: "/admin/sellers",
      },
      {
        label: "Buyers today",
        value: number(stats?.unique_buyers_today),
        detail: "Distinct completed buyers",
        icon: PackageCheck,
        href: "/admin/analytics/users",
      },
    ],
    [stats],
  );

  const openReports = reports.filter((report) => report.status !== "resolved" && report.status !== "dismissed").length;
  const queuedPayouts = payouts.filter((payout) => payout.status === "pending").length;

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-primary">Overview</p>
          <h2 className="mt-2 text-2xl font-semibold text-textPrimary">Marketplace health</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-textSecondary">
            High-level account, catalog, revenue, and moderation signals from the existing admin analytics API.
          </p>
        </div>
        <Link href="/admin/analytics" className="inline-flex items-center gap-2 text-sm text-primary hover:text-textPrimary">
          Full analytics <ArrowRight className="size-4" />
        </Link>
      </div>

      {status === "blocked" ? (
        <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
          Admin analytics could not load. This usually means the browser does not have a valid admin session yet.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ label, value, detail, icon: Icon, href }) => (
          <Link
            key={label}
            href={href}
            className="group rounded-2xl border border-border bg-surface p-5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-elevated"
          >
            <div className="mb-7 flex items-center justify-between">
              <Icon className="size-5 text-primary" />
              <ArrowRight className="size-4 text-textSecondary transition group-hover:translate-x-1 group-hover:text-primary" />
            </div>
            <p className="text-3xl font-semibold text-textPrimary">{status === "loading" ? "..." : value}</p>
            <p className="mt-1 text-sm text-textSecondary">{label}</p>
            <p className="mt-5 text-xs text-textSecondary">{status === "loading" ? "Loading live data" : detail}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-2xl border border-border bg-surface p-5">
          <div className="mb-5 flex items-center gap-3">
            <ShieldAlert className="size-5 text-warning" />
            <div>
              <h3 className="text-base font-semibold text-textPrimary">Moderation queue</h3>
              <p className="text-sm text-textSecondary">The fastest operational checks for a marketplace launch.</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: "Pending products", value: number(stats?.pending_products), href: "/admin/products" },
              { label: "Open reports", value: number(openReports), href: "/admin/reports" },
              { label: "Queued payouts", value: number(queuedPayouts), href: "/admin/payouts" },
            ].map((item) => (
              <Link key={item.label} href={item.href} className="rounded-2xl border border-border bg-elevated p-4">
                <p className="text-2xl font-semibold text-textPrimary">{status === "loading" ? "..." : item.value}</p>
                <p className="mt-1 text-xs text-textSecondary">{item.label}</p>
              </Link>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-border bg-surface p-5">
          <div className="mb-5 flex items-center gap-3">
            <Clock3 className="size-5 text-success" />
            <div>
              <h3 className="text-base font-semibold text-textPrimary">Next admin pass</h3>
              <p className="text-sm text-textSecondary">Useful shortcuts for user and catalog review.</p>
            </div>
          </div>
          <div className="space-y-2">
            {[
              { label: "Review newest users", href: "/admin/users" },
              { label: "Approve product submissions", href: "/admin/products" },
              { label: "Check revenue trends", href: "/admin/analytics/revenue" },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center justify-between rounded-xl border border-border bg-elevated px-4 py-3 text-sm text-textSecondary transition hover:border-primary/35 hover:text-textPrimary"
              >
                {item.label}
                <ArrowRight className="size-4" />
              </Link>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
