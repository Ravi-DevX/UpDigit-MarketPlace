"use client";

import { useEffect, useState } from "react";
import { Clock3, ShoppingCart } from "lucide-react";
import { fetchSellerOrders } from "@/lib/api";
import type { Order } from "@/types/marketplace";

function money(value: number) {
  return new Intl.NumberFormat("en", { style: "currency", currency: "USD" }).format(value || 0);
}

function date(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export default function SellerOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    fetchSellerOrders()
      .then((items) => {
        if (mounted) {
          setOrders(items);
        }
      })
      .catch(() => {
        if (mounted) {
          setError("Could not load seller orders.");
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-primary">Fulfillment</p>
        <h2 className="mt-2 text-2xl font-semibold text-textPrimary">Seller orders</h2>
        <p className="mt-2 text-sm text-textSecondary">Track customer orders, delivery status, license keys, and earnings.</p>
      </div>
      {error ? <div className="rounded-2xl border border-danger/50 bg-danger/10 p-3 text-sm text-danger">{error}</div> : null}
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="grid grid-cols-[1fr_0.8fr_0.8fr_0.8fr_0.7fr] gap-3 border-b border-border px-4 py-3 text-xs uppercase tracking-[0.12em] text-textSecondary max-lg:hidden">
          <span>Order</span>
          <span>Status</span>
          <span>Amount</span>
          <span>Earnings</span>
          <span>Date</span>
        </div>
        <div className="divide-y divide-white/10">
          {loading ? (
            <div className="px-4 py-8 text-center text-sm text-textSecondary">Loading orders...</div>
          ) : orders.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-textSecondary">
              <ShoppingCart className="mx-auto mb-3 size-8 text-primary" />
              No orders yet.
            </div>
          ) : (
            orders.map((order) => (
              <div key={order.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[1fr_0.8fr_0.8fr_0.8fr_0.7fr] lg:items-center">
                <span>
                  <span className="block text-sm font-medium text-textPrimary">{order.id.slice(0, 12)}</span>
                  <span className="block text-xs text-textSecondary">Product {order.product_id.slice(0, 8)}</span>
                </span>
                <span className="w-fit rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-textSecondary">{order.status}</span>
                <span className="text-sm text-textPrimary">{money(order.amount)}</span>
                <span className="text-sm text-success">{money(order.seller_earnings)}</span>
                <span className="inline-flex items-center gap-1 text-sm text-textSecondary"><Clock3 className="size-3.5" />{date(order.created_at)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
