"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Plus, Search, Trash2 } from "lucide-react";
import { createAdminCoupon, deleteAdminCoupon, fetchAdminCoupons, updateAdminCoupon } from "@/lib/api";
import type { Coupon } from "@/types/marketplace";
import type { CouponInput } from "@/lib/api";
import {
  actionButtonClass,
  EmptyState,
  ErrorState,
  formatDate,
  LoadingState,
  PageHeader,
  StatusBadge,
} from "@/app/admin/_components/AdminUI";

function dateInputToISO(value: string) {
  return value ? new Date(`${value}T23:59:59Z`).toISOString() : null;
}

function couponPayload(form: HTMLFormElement): CouponInput {
  const data = new FormData(form);
  const maxUses = String(data.get("max_uses") || "").trim();
  return {
    code: String(data.get("code") || "").trim(),
    discount_type: String(data.get("discount_type") || "percentage") as "percentage" | "fixed",
    discount_value: Number(data.get("discount_value") || 0),
    max_uses: maxUses ? Number(maxUses) : null,
    product_id: String(data.get("product_id") || "").trim() || null,
    expires_at: dateInputToISO(String(data.get("expires_at") || "")),
    is_active: data.get("is_active") === "on",
  };
}

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [query, setQuery] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setState("loading");
    try {
      setCoupons(await fetchAdminCoupons());
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
      return coupons;
    }
    return coupons.filter((coupon) => [coupon.code, coupon.discount_type, coupon.product_id || "", coupon.seller_id || ""].some((value) => value.toLowerCase().includes(needle)));
  }, [coupons, query]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreating(true);
    try {
      await createAdminCoupon(couponPayload(event.currentTarget));
      event.currentTarget.reset();
      await load();
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (coupon: Coupon) => {
    setBusyId(coupon.id);
    try {
      await updateAdminCoupon(coupon.id, {
        code: coupon.code,
        discount_type: coupon.discount_type as "percentage" | "fixed",
        discount_value: coupon.discount_value,
        max_uses: coupon.max_uses ?? null,
        product_id: coupon.product_id ?? null,
        expires_at: coupon.expires_at ?? null,
        is_active: !coupon.is_active,
      });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (coupon: Coupon) => {
    setBusyId(coupon.id);
    try {
      await deleteAdminCoupon(coupon.id);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Promotions"
        title="Platform coupons"
        description="Create global promotions, product-specific discounts, usage caps, and expiration windows."
      />

      <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-border bg-surface p-4 lg:grid-cols-[1fr_0.8fr_0.65fr_0.65fr_1fr_0.7fr_auto] lg:items-end">
        <label className="grid gap-1 text-xs text-textSecondary">
          Code
          <input name="code" required placeholder="LAUNCH25" className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-textPrimary outline-none" />
        </label>
        <label className="grid gap-1 text-xs text-textSecondary">
          Type
          <select name="discount_type" className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-textPrimary outline-none">
            <option value="percentage">Percentage</option>
            <option value="fixed">Fixed</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs text-textSecondary">
          Value
          <input name="discount_value" required min="0" step="0.01" type="number" className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-textPrimary outline-none" />
        </label>
        <label className="grid gap-1 text-xs text-textSecondary">
          Max uses
          <input name="max_uses" min="0" type="number" className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-textPrimary outline-none" />
        </label>
        <label className="grid gap-1 text-xs text-textSecondary">
          Product ID
          <input name="product_id" placeholder="optional" className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-textPrimary outline-none" />
        </label>
        <label className="grid gap-1 text-xs text-textSecondary">
          Expires
          <input name="expires_at" type="date" className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-textPrimary outline-none" />
        </label>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-textSecondary">
            <input name="is_active" type="checkbox" defaultChecked className="size-4 accent-primary" />
            Active
          </label>
          <button disabled={creating} type="submit" className={actionButtonClass("primary")}>
            <Plus className="size-4" />
            Create
          </button>
        </div>
      </form>

      <label className="flex items-center gap-2 rounded-2xl border border-border bg-surface px-3 py-2 text-sm text-textSecondary">
        <Search className="size-4" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search code, type, product, seller..."
          className="min-w-0 flex-1 bg-transparent text-textPrimary outline-none placeholder:text-textSecondary"
        />
      </label>

      {state === "error" ? <ErrorState message="Coupons could not load." /> : null}
      {state === "loading" ? <LoadingState label="Loading coupons..." /> : null}
      {state === "ready" && filtered.length === 0 ? <EmptyState title="No coupons found" description="Create the first platform coupon above." /> : null}

      {state === "ready" && filtered.length > 0 ? (
        <div className="grid gap-3">
          {filtered.map((coupon) => (
            <article key={coupon.id} className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono text-lg font-semibold text-textPrimary">{coupon.code}</p>
                    <StatusBadge value={coupon.is_active} />
                    {coupon.seller_id ? <StatusBadge value="seller coupon" /> : <StatusBadge value="platform coupon" />}
                  </div>
                  <p className="mt-2 text-sm text-textSecondary">
                    {coupon.discount_type === "percentage" ? `${coupon.discount_value}% off` : `$${coupon.discount_value.toFixed(2)} off`} · used {coupon.uses_count}
                    {coupon.max_uses ? ` / ${coupon.max_uses}` : ""} · expires {coupon.expires_at ? formatDate(coupon.expires_at) : "never"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button disabled={busyId === coupon.id} type="button" onClick={() => toggleActive(coupon)} className={actionButtonClass("neutral")}>
                    {coupon.is_active ? "Deactivate" : "Activate"}
                  </button>
                  <button disabled={busyId === coupon.id} type="button" onClick={() => remove(coupon)} className={actionButtonClass("danger")}>
                    <Trash2 className="size-4" />
                    Delete
                  </button>
                  <Link href={`/admin/coupons/${coupon.id}`} className={actionButtonClass("neutral")}>
                    Edit
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
