"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Search, XCircle } from "lucide-react";
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

export default function AdminSellersPage() {
  const [sellers, setSellers] = useState<SellerProfile[]>([]);
  const [query, setQuery] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setState("loading");
    try {
      setSellers(await fetchAdminSellerApplications());
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
      return sellers;
    }
    return sellers.filter((seller) =>
      [seller.shop_name, seller.shop_slug, seller.user_id, seller.id].some((value) => value.toLowerCase().includes(needle)),
    );
  }, [sellers, query]);

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
        eyebrow="Seller operations"
        title="Seller applications"
        description="Review pending creator stores and approve or reject seller profile access."
      />

      <label className="flex items-center gap-2 rounded-2xl border border-border bg-surface px-3 py-2 text-sm text-textSecondary">
        <Search className="size-4" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search shop, slug, user ID..."
          className="min-w-0 flex-1 bg-transparent text-textPrimary outline-none placeholder:text-textSecondary"
        />
      </label>

      {state === "error" ? <ErrorState message="Seller applications could not load." /> : null}
      {state === "loading" ? <LoadingState label="Loading seller applications..." /> : null}
      {state === "ready" && filtered.length === 0 ? (
        <EmptyState title="No pending applications" description="All seller profile applications have been reviewed." />
      ) : null}

      {state === "ready" && filtered.length > 0 ? (
        <div className="grid gap-4">
          {filtered.map((seller) => (
            <article key={seller.id} className="rounded-2xl border border-border bg-surface p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-textPrimary">{seller.shop_name}</h3>
                    <StatusBadge value={seller.approved ? "approved" : "pending"} />
                  </div>
                  <p className="truncate text-sm text-textSecondary">/{seller.shop_slug} · user {seller.user_id}</p>
                  <p className="mt-2 text-sm leading-6 text-textSecondary">{seller.shop_description || "No shop description provided."}</p>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-textSecondary">
                    <span>{formatMoney(seller.total_revenue || 0)} revenue</span>
                    <span>{seller.total_sales || 0} sales</span>
                    <span>Created {formatDate(seller.created_at)}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busyId === seller.id}
                    onClick={() => run(seller.id, () => approveAdminSeller(seller.id))}
                    className={actionButtonClass("primary")}
                  >
                    <CheckCircle2 className="size-4" />
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={busyId === seller.id}
                    onClick={() => run(seller.id, () => rejectAdminSeller(seller.id))}
                    className={actionButtonClass("danger")}
                  >
                    <XCircle className="size-4" />
                    Reject
                  </button>
                  <Link href={`/admin/sellers/${seller.id}`} className={actionButtonClass("neutral")}>
                    Detail
                    <ArrowRight className="size-4" />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
