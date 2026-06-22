"use client";

import { FormEvent, useEffect, useState } from "react";
import { Loader2, Plus, Ticket } from "lucide-react";
import { createSellerCoupon, fetchSellerCoupons } from "@/lib/api";
import type { Coupon } from "@/types/marketplace";

export default function SellerCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState("percent");
  const [discountValue, setDiscountValue] = useState("10");
  const [maxUses, setMaxUses] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => setCoupons(await fetchSellerCoupons());

  useEffect(() => {
    load().catch(() => setError("Could not load coupons."));
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await createSellerCoupon({
        code: code.trim().toLowerCase(),
        discount_type: discountType,
        discount_value: Number(discountValue),
        max_uses: maxUses ? Number(maxUses) : null,
        is_active: true,
      });
      setCode("");
      setDiscountValue("10");
      setMaxUses("");
      await load();
    } catch {
      setError("Could not create coupon.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-primary">Promotions</p>
        <h2 className="mt-2 text-2xl font-semibold text-textPrimary">Coupons</h2>
        <p className="mt-2 text-sm text-textSecondary">Create percentage or fixed-amount coupon codes for campaigns.</p>
      </div>
      {error ? <div className="rounded-2xl border border-danger/50 bg-danger/10 p-3 text-sm text-danger">{error}</div> : null}
      <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-border bg-surface p-5 md:grid-cols-[1fr_160px_140px_120px_auto]">
        <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="LAUNCH25" className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-primary/60" required />
        <select value={discountType} onChange={(event) => setDiscountType(event.target.value)} className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary/60">
          <option value="percent">Percent</option>
          <option value="fixed">Fixed</option>
        </select>
        <input type="number" value={discountValue} onChange={(event) => setDiscountValue(event.target.value)} className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-primary/60" />
        <input type="number" value={maxUses} onChange={(event) => setMaxUses(event.target.value)} placeholder="Max uses" className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-primary/60" />
        <button disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm text-primary-foreground disabled:opacity-50">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Create
        </button>
      </form>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {coupons.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-textSecondary">No coupons configured.</div>
        ) : (
          coupons.map((coupon) => (
            <article key={coupon.id} className="rounded-2xl border border-border bg-surface p-5">
              <Ticket className="mb-5 size-5 text-primary" />
              <p className="text-lg font-semibold text-textPrimary">{coupon.code}</p>
              <p className="mt-1 text-sm text-textSecondary">{coupon.discount_value}{coupon.discount_type === "percent" ? "%" : " USD"} off</p>
              <p className="mt-4 text-xs text-textSecondary">{coupon.uses_count} uses{coupon.max_uses ? ` / ${coupon.max_uses}` : ""}</p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
