"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Eye, PackagePlus, Pencil, UploadCloud } from "lucide-react";
import { Product } from "@/types/marketplace";
import { applySeller, fetchSellerDashboardProducts } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function money(value: number) {
  return value <= 0 ? "Free" : `$${value.toFixed(2)}`;
}

export default function SellerProductsPage() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const role = useAuthStore((state) => state.user?.role);
  const user = useAuthStore((state) => state.user);
  const canManageProducts = role === "seller" || role === "admin";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [applying, setApplying] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesQuery =
        !query.trim() ||
        String(product.public_id ?? "").includes(query.trim()) ||
        product.title.toLowerCase().includes(query.toLowerCase()) ||
        product.slug.toLowerCase().includes(query.toLowerCase());
      const matchesStatus = statusFilter === "all" || product.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [products, query, statusFilter]);

  const onApply = async () => {
    if (!user) {
      return;
    }
    setApplying(true);
    setError("");
    setMessage("");
    try {
      const shopSlug = `${slugify(user.username)}-shop`;
      await applySeller({
        shop_name: `${user.username} Store`,
        shop_slug: shopSlug || "seller-store",
        shop_description: `Created from ${user.username}`,
      });
      setMessage("Seller application submitted. An admin needs to approve it before you can manage listings.");
    } catch {
      setError("Could not apply as seller. Please retry or contact support.");
    } finally {
      setApplying(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      setMessage("");
      try {
        const list = await fetchSellerDashboardProducts();
        if (!cancelled) {
          setProducts(list);
        }
      } catch {
        if (!cancelled) {
          setError("Unable to load seller products. Please sign in as a seller.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    if (isAuthenticated && canManageProducts) {
      void load();
    } else {
      setProducts([]);
    }

    return () => {
      cancelled = true;
    };
  }, [canManageProducts, isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-textPrimary">Products</h2>
        <p className="text-sm text-textSecondary">Please sign in before managing products.</p>
        <Link href="/login" className="inline-block rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground">
          Sign in
        </Link>
      </section>
    );
  }

  if (!canManageProducts) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-textPrimary">Products</h2>
        <p className="text-sm text-textSecondary">You need seller access to manage listings. Apply as a seller first.</p>
        <button
          type="button"
          onClick={onApply}
          disabled={applying}
          className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
        >
          {applying ? "Applying..." : "Apply for Seller Access"}
        </button>
        {error ? <div className="rounded-2xl border border-danger/50 bg-danger/10 p-3 text-sm text-danger">{error}</div> : null}
        {message ? <div className="rounded-2xl border border-success/50 bg-success/10 p-3 text-sm text-success">{message}</div> : null}
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-primary">Catalog</p>
          <h2 className="mt-2 text-2xl font-semibold text-textPrimary">Products</h2>
          <p className="mt-2 text-sm text-textSecondary">Create, edit, and publish your marketplace listings.</p>
        </div>
        <Link href="/seller/products/new" className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground">
          <PackagePlus className="size-4" />
          New product
        </Link>
      </div>

      {error ? <div className="rounded-2xl border border-danger/50 bg-danger/10 p-3 text-sm text-danger">{error}</div> : null}
      {message ? <div className="rounded-2xl border border-success/50 bg-success/10 p-3 text-sm text-success">{message}</div> : null}

      <div className="grid gap-3 rounded-2xl border border-border bg-surface p-4 md:grid-cols-[1fr_180px]">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-primary/60"
          placeholder="Search your listings..."
        />
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary/60"
        >
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="grid grid-cols-[1.4fr_0.7fr_0.7fr_0.8fr_160px] gap-3 border-b border-border px-4 py-3 text-xs uppercase tracking-[0.12em] text-textSecondary max-lg:hidden">
          <span>Product</span>
          <span>Status</span>
          <span>Price</span>
          <span>Performance</span>
          <span />
        </div>
        <div className="divide-y divide-white/10">
          {loading ? (
            <div className="px-4 py-8 text-center text-sm text-textSecondary">Loading products...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <UploadCloud className="mx-auto mb-3 size-8 text-primary" />
              <p className="text-sm text-textSecondary">No products match this view.</p>
            </div>
          ) : (
            filteredProducts.map((product) => (
              <div key={product.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[1.4fr_0.7fr_0.7fr_0.8fr_160px] lg:items-center">
                <div className="flex min-w-0 items-center gap-3">
                  <img src={product.thumbnail_url || "/placeholder-product.png"} alt="" className="size-12 shrink-0 rounded-xl object-cover" />
                  <span className="min-w-0">
                    <Link href={`/products/${product.slug}`} className="block truncate text-sm font-medium text-textPrimary">
                      {product.title}
                    </Link>
                    <span className="block truncate text-xs text-textSecondary">ID {product.public_id ?? "-"} · {product.slug}</span>
                  </span>
                </div>
                <span className="w-fit rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-textSecondary">
                  {product.status || "unknown"}
                </span>
                <span className="text-sm font-semibold text-textPrimary">{money(product.price)}</span>
                <span className="text-sm text-textSecondary">
                  {product.total_sales} sales · {product.total_downloads} downloads
                </span>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/products/${product.slug}`} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs text-textSecondary hover:text-textPrimary">
                    <Eye className="size-3.5" />
                    View
                  </Link>
                  <Link href={`/seller/products/${product.slug}/edit`} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs text-textSecondary hover:text-textPrimary">
                    <Pencil className="size-3.5" />
                    Edit
                  </Link>
                  <Link href={`/seller/products/${product.slug}/versions`} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs text-textSecondary hover:text-textPrimary">
                    Files <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
