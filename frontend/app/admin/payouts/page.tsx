"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Search, XCircle } from "lucide-react";
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

export default function AdminPayoutsPage() {
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [query, setQuery] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setState("loading");
    try {
      setPayouts(await fetchAdminPayouts());
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
      return payouts;
    }
    return payouts.filter((payout) => [payout.id, payout.seller_id, payout.method, payout.status].some((value) => value.toLowerCase().includes(needle)));
  }, [payouts, query]);

  const run = async (id: string, action: () => Promise<void>) => {
    setBusyId(id);
    try {
      await action();
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Finance"
        title="Payouts"
        description="Approve or reject seller payout requests and keep payout status synchronized with audit logs."
      />

      <label className="flex items-center gap-2 rounded-2xl border border-border bg-surface px-3 py-2 text-sm text-textSecondary">
        <Search className="size-4" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search payout, seller, method, status..."
          className="min-w-0 flex-1 bg-transparent text-textPrimary outline-none placeholder:text-textSecondary"
        />
      </label>

      {state === "error" ? <ErrorState message="Payout requests could not load." /> : null}
      {state === "loading" ? <LoadingState label="Loading payout requests..." /> : null}
      {state === "ready" && filtered.length === 0 ? <EmptyState title="No payout requests" description="There are no payout requests matching the filter." /> : null}

      {state === "ready" && filtered.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="grid grid-cols-[1fr_0.55fr_0.6fr_0.6fr_0.75fr_0.85fr_40px] gap-3 border-b border-border px-4 py-3 text-xs uppercase tracking-[0.12em] text-textSecondary max-xl:hidden">
            <span>Payout</span>
            <span>Amount</span>
            <span>Method</span>
            <span>Status</span>
            <span>Created</span>
            <span>Actions</span>
            <span />
          </div>
          <div className="divide-y divide-white/10">
            {filtered.map((payout) => (
              <div key={payout.id} className="grid gap-4 px-4 py-4 xl:grid-cols-[1fr_0.55fr_0.6fr_0.6fr_0.75fr_0.85fr_40px] xl:items-center">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-textPrimary">{payout.id}</p>
                  <p className="mt-1 truncate text-xs text-textSecondary">seller {payout.seller_id}</p>
                </div>
                <span className="text-sm text-textPrimary">{formatMoney(payout.amount)}</span>
                <span className="text-sm capitalize text-textSecondary">{payout.method}</span>
                <StatusBadge value={payout.status} />
                <span className="text-sm text-textSecondary">{formatDate(payout.created_at)}</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busyId === payout.id || payout.status === "approved"}
                    onClick={() => run(payout.id, () => approveAdminPayout(payout.id))}
                    className={actionButtonClass("primary")}
                  >
                    <CheckCircle2 className="size-3.5" />
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={busyId === payout.id || payout.status === "rejected"}
                    onClick={() => run(payout.id, () => rejectAdminPayout(payout.id))}
                    className={actionButtonClass("danger")}
                  >
                    <XCircle className="size-3.5" />
                    Reject
                  </button>
                </div>
                <Link href={`/admin/payouts/${payout.id}`} className="text-textSecondary transition hover:text-primary">
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
