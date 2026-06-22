"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { deleteAdminCoupon, fetchAdminCoupons, updateAdminCoupon } from "@/lib/api";
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

function toDateInput(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

function toISODate(value: string) {
  return value ? new Date(`${value}T23:59:59Z`).toISOString() : null;
}

export default function AdminCouponDetailPage({ params }: { params: { id: string } }) {
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setState("loading");
    try {
      const coupons = await fetchAdminCoupons();
      setCoupon(coupons.find((item) => item.id === params.id) ?? null);
      setState("ready");
    } catch {
      setState("error");
    }
  };

  useEffect(() => {
    void load();
  }, [params.id]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!coupon) {
      return;
    }
    const form = new FormData(event.currentTarget);
    const maxUses = String(form.get("max_uses") || "").trim();
    const payload: CouponInput = {
      code: String(form.get("code") || "").trim(),
      discount_type: String(form.get("discount_type") || "percentage") as "percentage" | "fixed",
      discount_value: Number(form.get("discount_value") || 0),
      max_uses: maxUses ? Number(maxUses) : null,
      product_id: String(form.get("product_id") || "").trim() || null,
      expires_at: toISODate(String(form.get("expires_at") || "")),
      is_active: form.get("is_active") === "on",
    };
    setBusy(true);
    try {
      await updateAdminCoupon(coupon.id, payload);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!coupon) {
      return;
    }
    setBusy(true);
    try {
      await deleteAdminCoupon(coupon.id);
      window.location.href = "/admin/coupons";
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Coupon detail"
        title={coupon?.code || "Coupon"}
        description={`Coupon ID: ${params.id}`}
        action={
          <Link href="/admin/coupons" className={actionButtonClass("neutral")}>
            <ArrowLeft className="size-4" />
            Back to coupons
          </Link>
        }
      />

      {state === "error" ? <ErrorState message="Coupon detail could not load." /> : null}
      {state === "loading" ? <LoadingState label="Loading coupon detail..." /> : null}
      {state === "ready" && !coupon ? <EmptyState title="Coupon not found" description="This coupon was not returned by the admin coupons API." /> : null}

      {state === "ready" && coupon ? (
        <form onSubmit={submit} className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <article className="rounded-2xl border border-border bg-surface p-5">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <StatusBadge value={coupon.is_active} />
              {coupon.seller_id ? <StatusBadge value="seller coupon" /> : <StatusBadge value="platform coupon" />}
            </div>
            <p className="text-sm text-textSecondary">Created {formatDate(coupon.created_at)}</p>
            <p className="mt-2 text-sm text-textSecondary">
              Used {coupon.uses_count}
              {coupon.max_uses ? ` / ${coupon.max_uses}` : ""} times
            </p>
            <button disabled={busy} type="button" onClick={remove} className={`${actionButtonClass("danger")} mt-5 w-full`}>
              <Trash2 className="size-4" />
              Delete coupon
            </button>
          </article>

          <article className="rounded-2xl border border-border bg-surface p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1 text-xs text-textSecondary">
                Code
                <input name="code" defaultValue={coupon.code} required className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-textPrimary outline-none" />
              </label>
              <label className="grid gap-1 text-xs text-textSecondary">
                Discount type
                <select name="discount_type" defaultValue={coupon.discount_type} className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-textPrimary outline-none">
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs text-textSecondary">
                Discount value
                <input
                  name="discount_value"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={coupon.discount_value}
                  required
                  className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-textPrimary outline-none"
                />
              </label>
              <label className="grid gap-1 text-xs text-textSecondary">
                Max uses
                <input name="max_uses" type="number" min="0" defaultValue={coupon.max_uses ?? ""} className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-textPrimary outline-none" />
              </label>
              <label className="grid gap-1 text-xs text-textSecondary">
                Product ID
                <input name="product_id" defaultValue={coupon.product_id ?? ""} className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-textPrimary outline-none" />
              </label>
              <label className="grid gap-1 text-xs text-textSecondary">
                Expires
                <input name="expires_at" type="date" defaultValue={toDateInput(coupon.expires_at)} className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-textPrimary outline-none" />
              </label>
              <label className="flex items-center gap-2 text-sm text-textSecondary">
                <input name="is_active" type="checkbox" defaultChecked={coupon.is_active} className="size-4 accent-primary" />
                Active coupon
              </label>
            </div>
            <button disabled={busy} type="submit" className={`${actionButtonClass("primary")} mt-5`}>
              <Save className="size-4" />
              Save coupon
            </button>
          </article>
        </form>
      ) : null}
    </section>
  );
}
