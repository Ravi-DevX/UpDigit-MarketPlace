"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { approveAdminSeller, fetchAdminSellerApplications, rejectAdminSeller } from "@/lib/api";
import type { SellerProfile } from "@/types/marketplace";
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

export default function AdminSellerDetailPage({ params }: { params: { id: string } }) {
  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setState("loading");
    try {
      const sellers = await fetchAdminSellerApplications();
      setSeller(sellers.find((item) => item.id === params.id || item.user_id === params.id) ?? null);
      setState("ready");
    } catch {
      setState("error");
    }
  };

  useEffect(() => {
    void load();
  }, [params.id]);

  const run = async (action: () => Promise<void>) => {
    if (!seller) {
      return;
    }
    setBusy(true);
    try {
      await action();
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Seller application"
        title={seller?.shop_name || "Seller detail"}
        description={`Seller profile ID: ${params.id}`}
        action={
          <Link href="/admin/sellers" className={actionButtonClass("neutral")}>
            <ArrowLeft className="size-4" />
            Back to sellers
          </Link>
        }
      />

      {state === "error" ? <ErrorState message="Seller application could not load." /> : null}
      {state === "loading" ? <LoadingState label="Loading seller detail..." /> : null}
      {state === "ready" && !seller ? (
        <EmptyState title="Seller application not found" description="This seller may already be approved or removed from the pending queue." />
      ) : null}

      {state === "ready" && seller ? (
        <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
          <article className="rounded-2xl border border-border bg-surface p-5">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <StatusBadge value={seller.approved ? "approved" : "pending"} />
              <span className="text-sm text-textSecondary">Created {formatDate(seller.created_at)}</span>
            </div>
            <h3 className="text-xl font-semibold text-textPrimary">{seller.shop_name}</h3>
            <p className="mt-1 text-sm text-textSecondary">/{seller.shop_slug}</p>
            <p className="mt-4 text-sm leading-6 text-textSecondary">{seller.shop_description || "No shop description provided."}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-elevated p-4">
                <p className="text-xs text-textSecondary">Total sales</p>
                <p className="mt-2 text-2xl font-semibold text-textPrimary">{seller.total_sales || 0}</p>
              </div>
              <div className="rounded-2xl border border-border bg-elevated p-4">
                <p className="text-xs text-textSecondary">Revenue</p>
                <p className="mt-2 text-2xl font-semibold text-textPrimary">{formatMoney(seller.total_revenue || 0)}</p>
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-border bg-surface p-5">
            <div className="grid gap-3 text-sm">
              {[
                ["User ID", seller.user_id],
                ["Payout method", seller.payout_method || "Not set"],
                ["Payout details", seller.payout_details ? JSON.stringify(seller.payout_details, null, 2) : "Not set"],
                ["Banner URL", seller.shop_banner_url || "Not set"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-border bg-elevated p-4">
                  <p className="text-textSecondary">{label}</p>
                  <p className="mt-1 whitespace-pre-wrap break-all text-textPrimary">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button disabled={busy} type="button" onClick={() => run(() => approveAdminSeller(seller.id))} className={actionButtonClass("primary")}>
                <CheckCircle2 className="size-4" />
                Approve seller
              </button>
              <button disabled={busy} type="button" onClick={() => run(() => rejectAdminSeller(seller.id))} className={actionButtonClass("danger")}>
                <XCircle className="size-4" />
                Reject seller
              </button>
            </div>
          </article>
        </div>
      ) : null}
    </section>
  );
}
