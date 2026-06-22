"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, ExternalLink, Link2, Loader2, Star, Unlink, XCircle } from "lucide-react";
import {
  approveAdminProduct,
  fetchAdminProducts,
  rejectAdminProduct,
  setAdminProductFeatured,
  setAdminProductTebexPackage,
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

export default function AdminProductDetailPage({ params }: { params: { id: string } }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [packageBusy, setPackageBusy] = useState(false);
  const [packageID, setPackageID] = useState("");
  const [packageError, setPackageError] = useState<string | null>(null);
  const [packageMessage, setPackageMessage] = useState<string | null>(null);

  const load = async () => {
    setState("loading");
    try {
      const products = await fetchAdminProducts();
      const selected = products.find((item) => item.id === params.id || item.slug === params.id || String(item.public_id) === params.id) ?? null;
      setProduct(selected);
      setPackageID(selected?.metadata?.tebex_package_id ? String(selected.metadata.tebex_package_id) : "");
      setState("ready");
    } catch {
      setState("error");
    }
  };

  useEffect(() => {
    void load();
  }, [params.id]);

  const stats = useMemo(
    () => [
      ["Price", formatMoney(product?.price)],
      ["Sales", String(product?.total_sales || 0)],
      ["Downloads", String(product?.total_downloads || 0)],
      ["Reviews", String(product?.review_count || 0)],
    ],
    [product],
  );

  const run = async (action: () => Promise<void>) => {
    if (!product) {
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

  const saveTebexPackage = async (unlink = false) => {
    if (!product) return;
    const parsed = Number(packageID);
    if (!unlink && (!Number.isInteger(parsed) || parsed <= 0)) {
      setPackageError("Enter a valid Tebex package ID.");
      return;
    }
    setPackageBusy(true);
    setPackageError(null);
    setPackageMessage(null);
    try {
      await setAdminProductTebexPackage(product.id, unlink ? null : parsed);
      setPackageMessage(unlink ? "Tebex package unlinked." : `Tebex package ${parsed} linked.`);
      await load();
    } catch (error) {
      const response = error && typeof error === "object" && "response" in error
        ? (error as { response?: { data?: { error?: unknown } } }).response
        : undefined;
      setPackageError(typeof response?.data?.error === "string" ? response.data.error : "Tebex package mapping could not be saved.");
    } finally {
      setPackageBusy(false);
    }
  };

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Product moderation"
        title={product?.title || "Product detail"}
        description={product?.public_id ? `Product ID: ${product.public_id}` : "Loading product record..."}
        action={
          <Link href="/admin/products" className={actionButtonClass("neutral")}>
            <ArrowLeft className="size-4" />
            Back to products
          </Link>
        }
      />

      {state === "error" ? <ErrorState message="Product detail could not load." /> : null}
      {state === "loading" ? <LoadingState label="Loading product detail..." /> : null}
      {state === "ready" && !product ? (
        <EmptyState title="Product not found" description="This product was not returned by the admin product API." />
      ) : null}

      {state === "ready" && product ? (
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <article className="overflow-hidden rounded-2xl border border-border bg-surface">
            <div className="aspect-[16/9] bg-elevated">
              {product.banner_url || product.thumbnail_url ? (
                <img src={product.banner_url || product.thumbnail_url || ""} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-textSecondary">No product media</div>
              )}
            </div>
            <div className="p-5">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <StatusBadge value={product.status} />
                <StatusBadge value={product.is_featured ? "featured" : "not featured"} />
                {product.is_exclusive ? <StatusBadge value="exclusive" /> : null}
              </div>
              <p className="text-sm leading-6 text-textSecondary">{product.short_description || "No short description."}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/products/${product.slug}`} className={actionButtonClass("neutral")}>
                  <ExternalLink className="size-4" />
                  Public page
                </Link>
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-border bg-surface p-5">
            <div className="grid gap-3 sm:grid-cols-4">
              {stats.map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-border bg-elevated p-4">
                  <p className="text-xs text-textSecondary">{label}</p>
                  <p className="mt-2 text-lg font-semibold text-textPrimary">{value}</p>
                </div>
              ))}
            </div>

            <dl className="mt-5 grid gap-3 text-sm">
              <div className="rounded-xl border border-primary/25 bg-primary/10 p-4">
                <dt className="text-primary">Product ID</dt>
                <dd className="mt-1 font-mono text-lg font-semibold text-textPrimary">{product.public_id}</dd>
              </div>
              <div className="rounded-xl border border-border bg-elevated p-4">
                <dt className="text-textSecondary">Internal UUID</dt>
                <dd className="mt-1 break-all font-mono text-textPrimary">{product.id}</dd>
              </div>
              <div className="rounded-xl border border-border bg-elevated p-4">
                <dt className="text-textSecondary">Seller ID</dt>
                <dd className="mt-1 text-textPrimary">{product.seller_id}</dd>
              </div>
              <div className="rounded-xl border border-border bg-elevated p-4">
                <dt className="text-textSecondary">Slug</dt>
                <dd className="mt-1 text-textPrimary">{product.slug}</dd>
              </div>
              <div className="rounded-xl border border-border bg-elevated p-4">
                <dt className="text-textSecondary">Created</dt>
                <dd className="mt-1 text-textPrimary">{formatDate(product.created_at)}</dd>
              </div>
            </dl>

            <div className="mt-5 border-t border-border pt-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-textPrimary">Tebex package</p>
                  <p className="mt-1 text-xs text-textSecondary">Headless catalog mapping</p>
                </div>
                <StatusBadge value={packageID ? "linked" : "not linked"} />
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={packageID}
                  onChange={(event) => setPackageID(event.target.value)}
                  placeholder="Package ID"
                  aria-label="Tebex package ID"
                  className="h-10 min-w-0 flex-1 rounded border border-border bg-elevated px-3 text-sm text-textPrimary outline-none focus:border-primary"
                />
                <button disabled={packageBusy} type="button" onClick={() => void saveTebexPackage()} className={actionButtonClass("primary")}>
                  {packageBusy ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
                  Link package
                </button>
                {product.metadata?.tebex_package_id ? (
                  <button title="Unlink Tebex package" aria-label="Unlink Tebex package" disabled={packageBusy} type="button" onClick={() => void saveTebexPackage(true)} className={actionButtonClass("neutral")}>
                    <Unlink className="size-4" />
                  </button>
                ) : null}
              </div>
              {packageError ? <p className="mt-2 text-xs text-danger">{packageError}</p> : null}
              {packageMessage ? <p className="mt-2 text-xs text-success">{packageMessage}</p> : null}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button disabled={busy} type="button" onClick={() => run(() => approveAdminProduct(product.id))} className={actionButtonClass("primary")}>
                <CheckCircle2 className="size-4" />
                Approve
              </button>
              <button disabled={busy} type="button" onClick={() => run(() => rejectAdminProduct(product.id))} className={actionButtonClass("danger")}>
                <XCircle className="size-4" />
                Reject
              </button>
              <button
                disabled={busy}
                type="button"
                onClick={() => run(() => setAdminProductFeatured(product.id, !product.is_featured))}
                className={actionButtonClass("neutral")}
              >
                <Star className="size-4" />
                {product.is_featured ? "Remove featured" : "Feature product"}
              </button>
            </div>
          </article>
        </div>
      ) : null}
    </section>
  );
}
