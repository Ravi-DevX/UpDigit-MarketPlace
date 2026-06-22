"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Boxes, CreditCard, Download, Heart, ShieldCheck } from "lucide-react";
import { fetchOrders } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import type { Order } from "@/types/marketplace";

function money(value: number) {
  return new Intl.NumberFormat("en", { style: "currency", currency: "USD" }).format(value || 0);
}

function date(value?: string) {
  if (!value) {
    return "Unknown";
  }
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const [orders, setOrders] = useState<Order[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let mounted = true;
    fetchOrders()
      .then((payload) => {
        if (!mounted) {
          return;
        }
        setOrders(payload);
        setState("ready");
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

  const stats = useMemo(() => {
    const completed = orders.filter((order) => order.status === "completed");
    return [
      { label: "Active licenses", value: completed.length, detail: `${orders.length} total orders`, icon: ShieldCheck },
      { label: "Total spent", value: money(completed.reduce((sum, order) => sum + order.amount, 0)), detail: "Completed purchases", icon: CreditCard },
      { label: "Downloads ready", value: completed.filter((order) => order.license_key).length, detail: "License-backed orders", icon: Download },
    ];
  }, [orders]);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-primary">Account</p>
          <h1 className="mt-2 text-2xl font-semibold text-textPrimary">Buyer Dashboard</h1>
          <p className="mt-2 text-sm text-textSecondary">
            Manage purchases, active licenses, downloads, and public profile for {user?.display_name || user?.username || "your account"}.
          </p>
        </div>
        {user?.username ? (
          <Link href={`/members/${user.username}`} className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm text-textSecondary transition hover:border-primary/40 hover:text-textPrimary">
            View profile
            <ArrowRight className="size-4" />
          </Link>
        ) : null}
      </div>

      {state === "error" ? (
        <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
          Could not load orders. Refresh the page after signing in again.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map(({ label, value, detail, icon: Icon }) => (
          <article key={label} className="rounded-2xl border border-border bg-surface p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-textSecondary">{label}</p>
              <Icon className="size-4 text-primary" />
            </div>
            <p className="mt-3 text-3xl font-semibold text-textPrimary">{state === "loading" ? "..." : value}</p>
            <p className="mt-1 text-xs text-textSecondary">{detail}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-2xl border border-border bg-surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-textPrimary">Recent purchases</h2>
            <Link href="/dashboard/purchases" className="text-sm text-primary hover:text-textPrimary">View all</Link>
          </div>
          <div className="space-y-3">
            {state === "loading" ? (
              <div className="rounded-xl border border-border bg-elevated p-4 text-sm text-textSecondary">Loading purchases...</div>
            ) : orders.length === 0 ? (
              <div className="rounded-xl border border-border bg-elevated p-4 text-sm text-textSecondary">No purchases yet.</div>
            ) : (
              orders.slice(0, 5).map((order) => (
                <Link key={order.id} href={`/dashboard/purchases?order=${order.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-elevated p-4 transition hover:border-primary/40">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-textPrimary">Order {order.id.slice(0, 8)}</span>
                    <span className="block text-xs text-textSecondary">{date(order.created_at)} · {order.status}</span>
                  </span>
                  <span className="text-sm font-semibold text-textPrimary">{money(order.amount)}</span>
                </Link>
              ))
            )}
          </div>
        </article>

        <article className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-base font-semibold text-textPrimary">Quick access</h2>
          <div className="mt-4 grid gap-3">
            {[
              { href: "/products", label: "Browse marketplace", icon: Boxes },
              { href: "/dashboard/wishlist", label: "Wishlist", icon: Heart },
              { href: "/dashboard/settings", label: "Account settings", icon: ShieldCheck },
            ].map(({ href, label, icon: Icon }) => (
              <Link key={label} href={href} className="flex items-center justify-between rounded-xl border border-border bg-elevated px-4 py-3 text-sm text-textSecondary transition hover:border-primary/40 hover:text-textPrimary">
                <span className="inline-flex items-center gap-3">
                  <Icon className="size-4 text-primary" />
                  {label}
                </span>
                <ArrowRight className="size-4" />
              </Link>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
