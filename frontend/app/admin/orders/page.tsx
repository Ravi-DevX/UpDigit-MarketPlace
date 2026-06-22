"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, RotateCcw, Search } from "lucide-react";
import { fetchAdminOrders, refundAdminOrder } from "@/lib/api";
import type { Order } from "@/types/marketplace";
import {
  actionButtonClass,
  EmptyState,
  ErrorState,
  formatDate,
  formatMoney,
  LoadingState,
  PageHeader,
  StatusBadge,
} from "@/app/admin/_components/AdminUI";

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [query, setQuery] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setState("loading");
    try {
      setOrders(await fetchAdminOrders());
      setState("ready");
    } catch {
      setState("error");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return orders;
    }
    return orders.filter((order) =>
      [order.id, order.buyer_id, order.seller_id, order.product_id, order.status, order.payment_id || ""].some((value) =>
        value.toLowerCase().includes(needle),
      ),
    );
  }, [orders, query]);

  const refund = async (order: Order) => {
    setBusyId(order.id);
    try {
      await refundAdminOrder(order.id);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Commerce"
        title="Orders"
        description="Review marketplace orders, payment identifiers, seller earnings, platform fees, and issue refunds."
      />

      <label className="flex items-center gap-2 rounded-2xl border border-border bg-surface px-3 py-2 text-sm text-textSecondary">
        <Search className="size-4" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search order, buyer, seller, product, payment..."
          className="min-w-0 flex-1 bg-transparent text-textPrimary outline-none placeholder:text-textSecondary"
        />
      </label>

      {state === "error" ? <ErrorState message="Orders could not load. Check admin session permissions." /> : null}
      {state === "loading" ? <LoadingState label="Loading orders..." /> : null}
      {state === "ready" && filtered.length === 0 ? <EmptyState title="No orders found" description="No orders match the current search." /> : null}

      {state === "ready" && filtered.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="grid grid-cols-[1fr_0.55fr_0.6fr_0.65fr_0.7fr_0.85fr_40px] gap-3 border-b border-border px-4 py-3 text-xs uppercase tracking-[0.12em] text-textSecondary max-xl:hidden">
            <span>Order</span>
            <span>Amount</span>
            <span>Fee</span>
            <span>Status</span>
            <span>Created</span>
            <span>Actions</span>
            <span />
          </div>
          <div className="divide-y divide-white/10">
            {filtered.map((order) => (
              <div key={order.id} className="grid gap-4 px-4 py-4 xl:grid-cols-[1fr_0.55fr_0.6fr_0.65fr_0.7fr_0.85fr_40px] xl:items-center">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-textPrimary">{order.id}</p>
                  <p className="mt-1 truncate text-xs text-textSecondary">
                    product {order.product_id} · buyer {order.buyer_id}
                  </p>
                  <p className="mt-1 truncate text-xs text-textSecondary">seller {order.seller_id}</p>
                </div>
                <span className="text-sm text-textPrimary">{formatMoney(order.amount)}</span>
                <span className="text-sm text-textSecondary">{formatMoney(order.platform_fee)}</span>
                <StatusBadge value={order.status} />
                <span className="text-sm text-textSecondary">{formatDate(order.created_at)}</span>
                <button
                  type="button"
                  disabled={busyId === order.id || order.status === "refunded"}
                  onClick={() => refund(order)}
                  className={actionButtonClass(order.status === "refunded" ? "neutral" : "danger")}
                >
                  <RotateCcw className="size-3.5" />
                  Refund
                </button>
                <Link href={`/admin/orders/${order.id}`} className="text-textSecondary transition hover:text-primary">
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
