"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, FileKey2, Search, ShieldCheck } from "lucide-react";
import { fetchOrderDownload, fetchOrders, fetchProducts, verifyTebexCheckout } from "@/lib/api";
import type { Order, Product } from "@/types/marketplace";

function money(value: number) {
  return new Intl.NumberFormat("en", { style: "currency", currency: "USD" }).format(value || 0);
}

function date(value?: string) {
  if (!value) {
    return "Unknown";
  }
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function statusClass(status: string) {
  switch (status) {
    case "completed":
      return "border-success/30 bg-success/10 text-success";
    case "refunded":
    case "failed":
      return "border-danger/30 bg-danger/10 text-danger";
    default:
      return "border-warning/30 bg-warning/10 text-warning";
  }
}

export default function PurchasesPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const verifyReturnedCheckout = async () => {
      const orderId = new URLSearchParams(window.location.search).get("tebex_order");
      if (!orderId) return;
      let lastError: unknown;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        try {
          await verifyTebexCheckout(orderId);
          const url = new URL(window.location.href);
          url.searchParams.delete("tebex_order");
          window.history.replaceState({}, "", url.pathname + url.search);
          return;
        } catch (error) {
          lastError = error;
          if (attempt < 3) await new Promise((resolve) => window.setTimeout(resolve, 1200 * (attempt + 1)));
        }
      }
      throw lastError;
    };
    verifyReturnedCheckout()
      .then(() => Promise.all([
        fetchOrders(),
        fetchProducts({ limit: 100 }).catch(() => [] as Product[]),
      ]))
      .then(([orderPayload, productPayload]) => {
        if (!mounted) {
          return;
        }
        setOrders(orderPayload);
        setProducts(productPayload);
        setStatus("ready");
      })
      .catch(() => {
        if (mounted) {
          setStatus("error");
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const productByID = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach((product) => map.set(product.id, product));
    return map;
  }, [products]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return orders;
    }
    return orders.filter((order) => {
      const product = productByID.get(order.product_id);
      return [
        order.id,
        order.status,
        order.license_key ?? "",
        product?.title ?? "",
        product?.seller?.username ?? "",
      ].some((value) => value.toLowerCase().includes(normalized));
    });
  }, [orders, productByID, query]);

  const download = async (order: Order) => {
    setDownloading(order.id);
    try {
      const payload = await fetchOrderDownload(order.id);
      window.location.href = payload.download_url;
    } finally {
      setDownloading(null);
    }
  };

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-primary">Licenses</p>
        <h1 className="mt-2 text-2xl font-semibold text-textPrimary">Your purchases</h1>
        <p className="mt-2 text-sm text-textSecondary">
          Open a product page for release notes, or download completed orders directly from the license row.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-textSecondary" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search resources, licenses, seller..."
            className="w-full rounded-xl border border-border bg-surface py-2.5 pl-10 pr-3 text-sm text-textPrimary outline-none transition focus:border-primary/50"
          />
        </div>
        <span className="rounded-full border border-border bg-surface px-3 py-2 text-sm text-textSecondary">
          {filtered.length} licenses
        </span>
      </div>

      {status === "error" ? (
        <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
          Purchases could not load. Refresh after confirming your session is active.
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        {status === "loading" ? (
          <div className="px-4 py-8 text-center text-sm text-textSecondary">Loading purchases...</div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-textSecondary">No matching purchases found.</div>
        ) : (
          <div className="divide-y divide-white/10">
            {filtered.map((order) => {
              const product = productByID.get(order.product_id);
              const active = order.status === "completed";
              return (
                <article key={order.id} className="grid gap-4 p-4 md:grid-cols-[1fr_190px_180px] md:items-center">
                  <div className="flex min-w-0 gap-4">
                    <Link href={product ? `/products/${product.slug}` : "#"} className="size-16 shrink-0 overflow-hidden rounded-2xl border border-border bg-surface">
                      {product?.thumbnail_url ? (
                        <img src={product.thumbnail_url} alt="" className="size-16 object-cover" />
                      ) : (
                        <span className="flex size-16 items-center justify-center text-textSecondary">
                          <FileKey2 className="size-5" />
                        </span>
                      )}
                    </Link>
                    <div className="min-w-0">
                      <Link href={product ? `/products/${product.slug}` : "#"} className="line-clamp-1 text-sm font-semibold text-textPrimary hover:text-primary">
                        {product?.title || `Product ${order.product_id.slice(0, 8)}`}
                      </Link>
                      <p className="mt-1 text-xs text-textSecondary">
                        {product?.seller?.username ? `by ${product.seller.username}` : `Order ${order.id.slice(0, 8)}`} · {money(order.amount)}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <span className={`rounded-full border px-2 py-1 ${statusClass(order.status)}`}>
                          {active ? "Active" : order.status}
                        </span>
                        <span className="rounded-full border border-border bg-surface px-2 py-1 text-textSecondary">
                          License {order.license_key ? order.license_key.slice(0, 10) : "pending"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-1">
                    <div>
                      <p className="text-xs text-textSecondary">Start date</p>
                      <p className="mt-1 text-textPrimary">{date(order.created_at)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-textSecondary">Expire</p>
                      <p className="mt-1 text-textPrimary">{active ? "Never" : "Unavailable"}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!active || downloading === order.id}
                    onClick={() => download(order)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm font-medium text-primary transition hover:bg-primary hover:text-primary-foreground disabled:cursor-not-allowed disabled:border-border disabled:bg-elevated disabled:text-textSecondary"
                  >
                    {active ? <Download className="size-4" /> : <ShieldCheck className="size-4" />}
                    {downloading === order.id ? "Preparing..." : active ? "Download" : "Not active"}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
