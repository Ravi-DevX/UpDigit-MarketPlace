"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RotateCcw } from "lucide-react";
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

export default function AdminOrderDetailPage({ params }: { params: { id: string } }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setState("loading");
    try {
      const orders = await fetchAdminOrders();
      setOrder(orders.find((item) => item.id === params.id) ?? null);
      setState("ready");
    } catch {
      setState("error");
    }
  };

  useEffect(() => {
    void load();
  }, [params.id]);

  const refund = async () => {
    if (!order) {
      return;
    }
    setBusy(true);
    try {
      await refundAdminOrder(order.id);
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Order detail"
        title={order?.id || "Order"}
        description="Inspect payment metadata, payout split, and fulfillment status."
        action={
          <Link href="/admin/orders" className={actionButtonClass("neutral")}>
            <ArrowLeft className="size-4" />
            Back to orders
          </Link>
        }
      />

      {state === "error" ? <ErrorState message="Order detail could not load." /> : null}
      {state === "loading" ? <LoadingState label="Loading order detail..." /> : null}
      {state === "ready" && !order ? <EmptyState title="Order not found" description="This order was not returned by the admin orders API." /> : null}

      {state === "ready" && order ? (
        <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <article className="rounded-2xl border border-border bg-surface p-5">
            <div className="flex items-center justify-between gap-3">
              <StatusBadge value={order.status} />
              <span className="text-sm text-textSecondary">{formatDate(order.created_at)}</span>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-2xl border border-border bg-elevated p-4">
                <p className="text-xs text-textSecondary">Amount</p>
                <p className="mt-2 text-2xl font-semibold text-textPrimary">{formatMoney(order.amount)}</p>
              </div>
              <div className="rounded-2xl border border-border bg-elevated p-4">
                <p className="text-xs text-textSecondary">Platform fee</p>
                <p className="mt-2 text-2xl font-semibold text-textPrimary">{formatMoney(order.platform_fee)}</p>
              </div>
              <div className="rounded-2xl border border-border bg-elevated p-4">
                <p className="text-xs text-textSecondary">Seller earnings</p>
                <p className="mt-2 text-2xl font-semibold text-textPrimary">{formatMoney(order.seller_earnings)}</p>
              </div>
            </div>
            <button
              type="button"
              disabled={busy || order.status === "refunded"}
              onClick={refund}
              className={`${actionButtonClass("danger")} mt-5 w-full`}
            >
              <RotateCcw className="size-4" />
              Refund order
            </button>
          </article>

          <article className="rounded-2xl border border-border bg-surface p-5">
            <div className="grid gap-3 text-sm">
              {[
                ["Buyer ID", order.buyer_id],
                ["Seller ID", order.seller_id],
                ["Product ID", order.product_id],
                ["Product Version ID", order.product_version_id || "None"],
                ["Payment Method", order.payment_method || "Unknown"],
                ["Payment ID", order.payment_id || "Unknown"],
                ["License Key", order.license_key || "Not issued"],
                ["Currency", order.currency],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-border bg-elevated p-4">
                  <p className="text-textSecondary">{label}</p>
                  <p className="mt-1 break-all text-textPrimary">{value}</p>
                </div>
              ))}
            </div>
          </article>
        </div>
      ) : null}
    </section>
  );
}
