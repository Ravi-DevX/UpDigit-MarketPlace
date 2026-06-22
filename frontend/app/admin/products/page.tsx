"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Search, Star, XCircle } from "lucide-react";
import {
  approveAdminProduct,
  fetchAdminProducts,
  rejectAdminProduct,
  setAdminProductFeatured,
} from "@/lib/api";
import type { Product } from "@/types/marketplace";
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

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setState("loading");
    try {
      setProducts(await fetchAdminProducts());
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
    return products.filter((product) => {
      const matchesQuery =
        !needle ||
        String(product.public_id ?? "").includes(needle) ||
        product.title.toLowerCase().includes(needle) ||
        product.slug.toLowerCase().includes(needle) ||
        product.seller_id.toLowerCase().includes(needle);
      const matchesStatus = statusFilter === "all" || (product.status || "").toLowerCase() === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [products, query, statusFilter]);

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
        eyebrow="Catalog moderation"
        title="Products"
        description="Approve submissions, reject unsafe listings, and control featured placement from the live product catalog."
      />

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-3 md:flex-row md:items-center">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-textSecondary">
          <Search className="size-4" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search product ID, title, slug, seller ID..."
            className="min-w-0 flex-1 bg-transparent text-textPrimary outline-none placeholder:text-textSecondary"
          />
        </label>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-textPrimary outline-none"
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="draft">Draft</option>
        </select>
      </div>

      {state === "error" ? <ErrorState message="Products could not load. Check that your current session has admin access." /> : null}
      {state === "loading" ? <LoadingState label="Loading product moderation queue..." /> : null}

      {state === "ready" && filtered.length === 0 ? (
        <EmptyState title="No products found" description="There are no products matching the current filter." />
      ) : null}

      {state === "ready" && filtered.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="grid grid-cols-[1.4fr_0.55fr_0.55fr_0.75fr_1fr_40px] gap-3 border-b border-border px-4 py-3 text-xs uppercase tracking-[0.12em] text-textSecondary max-lg:hidden">
            <span>Listing</span>
            <span>Price</span>
            <span>Status</span>
            <span>Created</span>
            <span>Actions</span>
            <span />
          </div>
          <div className="divide-y divide-white/10">
            {filtered.map((product) => (
              <div
                key={product.id}
                className="grid gap-4 px-4 py-4 lg:grid-cols-[1.4fr_0.55fr_0.55fr_0.75fr_1fr_40px] lg:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-textPrimary">{product.title}</p>
                  <p className="mt-1 truncate text-xs text-textSecondary">
                    ID {product.public_id ?? "-"} · {product.slug} · seller {product.seller_id}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-textSecondary">
                    <span>{product.total_sales || 0} sales</span>
                    <span>{product.total_downloads || 0} downloads</span>
                    {product.is_featured ? <span className="text-primary">Featured</span> : null}
                  </div>
                </div>
                <span className="text-sm text-textPrimary">{formatMoney(product.price)}</span>
                <StatusBadge value={product.status} />
                <span className="text-sm text-textSecondary">{formatDate(product.created_at)}</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busyId === product.id}
                    onClick={() => run(product.id, () => approveAdminProduct(product.id))}
                    className={actionButtonClass("primary")}
                  >
                    <CheckCircle2 className="size-3.5" />
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={busyId === product.id}
                    onClick={() => run(product.id, () => rejectAdminProduct(product.id))}
                    className={actionButtonClass("danger")}
                  >
                    <XCircle className="size-3.5" />
                    Reject
                  </button>
                  <button
                    type="button"
                    disabled={busyId === product.id}
                    onClick={() => run(product.id, () => setAdminProductFeatured(product.id, !product.is_featured))}
                    className={actionButtonClass("neutral")}
                  >
                    <Star className="size-3.5" />
                    {product.is_featured ? "Unfeature" : "Feature"}
                  </button>
                </div>
                <Link href={`/admin/products/${product.id}`} className="text-textSecondary transition hover:text-primary">
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
