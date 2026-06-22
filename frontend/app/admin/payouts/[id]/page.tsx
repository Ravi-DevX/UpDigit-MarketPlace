"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { approveAdminPayout, fetchAdminPayouts, rejectAdminPayout } from "@/lib/api";
import type { PayoutRequest } from "@/types/marketplace";
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

export default function AdminPayoutDetailPage({ params }: { params: { id: string } }) {
  const [payout, setPayout] = useState<PayoutRequest | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setState("loading");
    try {
      const payouts = await fetchAdminPayouts();
      setPayout(payouts.find((item) => item.id === params.id) ?? null);
      setState("ready");
    } catch {
      setState("error");
    }
  };

  useEffect(() => {
    void load();
  }, [params.id]);

  const run = async (action: () => Promise<void>) => {
    if (!payout) {
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
        eyebrow="Payout detail"
        title={payout?.id || "Payout"}
        description="Review request details and update payout status."
        action={
          <Link href="/admin/payouts" className={actionButtonClass("neutral")}>
            <ArrowLeft className="size-4" />
            Back to payouts
          </Link>
        }
      />

      {state === "error" ? <ErrorState message="Payout detail could not load." /> : null}
      {state === "loading" ? <LoadingState label="Loading payout detail..." /> : null}
      {state === "ready" && !payout ? <EmptyState title="Payout not found" description="This payout was not returned by the admin API." /> : null}

      {state === "ready" && payout ? (
        <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <article className="rounded-2xl border border-border bg-surface p-5">
            <div className="flex items-center justify-between gap-3">
              <StatusBadge value={payout.status} />
              <span className="text-sm text-textSecondary">{formatDate(payout.created_at)}</span>
            </div>
            <p className="mt-6 text-4xl font-semibold text-textPrimary">{formatMoney(payout.amount)}</p>
            <p className="mt-2 text-sm capitalize text-textSecondary">{payout.method} payout</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button disabled={busy} type="button" onClick={() => run(() => approveAdminPayout(payout.id))} className={actionButtonClass("primary")}>
                <CheckCircle2 className="size-4" />
                Approve
              </button>
              <button disabled={busy} type="button" onClick={() => run(() => rejectAdminPayout(payout.id))} className={actionButtonClass("danger")}>
                <XCircle className="size-4" />
                Reject
              </button>
            </div>
          </article>

          <article className="rounded-2xl border border-border bg-surface p-5">
            <div className="grid gap-3 text-sm">
              {[
                ["Seller ID", payout.seller_id],
                ["Notes", payout.notes || "No notes"],
                ["Processed By", payout.processed_by || "Not processed"],
                ["Processed At", payout.processed_at ? formatDate(payout.processed_at) : "Not processed"],
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
