"use client";

import { FormEvent, useEffect, useState } from "react";
import { Loader2, Save, Store } from "lucide-react";
import { fetchSellerSettings, updateSellerSettings } from "@/lib/api";

export default function SellerSettingsPage() {
  const [shopName, setShopName] = useState("");
  const [shopSlug, setShopSlug] = useState("");
  const [shopDescription, setShopDescription] = useState("");
  const [shopBannerURL, setShopBannerURL] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("");
  const [payoutAccount, setPayoutAccount] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    fetchSellerSettings()
      .then((profile) => {
        if (!mounted) {
          return;
        }
        setShopName(profile.shop_name ?? "");
        setShopSlug(profile.shop_slug ?? "");
        setShopDescription(profile.shop_description ?? "");
        setShopBannerURL(profile.shop_banner_url ?? "");
        setPayoutMethod((profile as typeof profile & { payout_method?: string | null }).payout_method ?? "");
        const details = (profile as typeof profile & { payout_details?: { account?: string } | null }).payout_details;
        setPayoutAccount(details?.account ?? "");
      })
      .catch(() => {
        if (mounted) {
          setError("Could not load store settings.");
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const updated = await updateSellerSettings({
        shop_name: shopName.trim(),
        shop_slug: shopSlug.trim().toLowerCase(),
        shop_description: shopDescription.trim() || null,
        shop_banner_url: shopBannerURL.trim() || null,
        payout_method: payoutMethod.trim() || null,
        payout_details: payoutAccount.trim() ? { account: payoutAccount.trim() } : {},
      });
      setShopName(updated.shop_name);
      setShopSlug(updated.shop_slug);
      setMessage("Store settings saved.");
    } catch {
      setError("Could not save store settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-primary">Storefront</p>
        <h2 className="mt-2 text-2xl font-semibold text-textPrimary">Store settings</h2>
        <p className="mt-2 text-sm text-textSecondary">Control shop identity, public profile copy, banner, and payout target.</p>
      </div>
      {error ? <div className="rounded-2xl border border-danger/50 bg-danger/10 p-3 text-sm text-danger">{error}</div> : null}
      {message ? <div className="rounded-2xl border border-success/50 bg-success/10 p-3 text-sm text-success">{message}</div> : null}
      <form onSubmit={submit} className="grid gap-5 xl:grid-cols-[1fr_0.8fr]">
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h3 className="text-base font-semibold text-textPrimary">Shop profile</h3>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="text-textSecondary">Shop name</span>
              <input disabled={loading} value={shopName} onChange={(event) => setShopName(event.target.value)} className="w-full rounded-2xl border border-border bg-surface px-4 py-3 outline-none focus:border-primary/60" required />
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-textSecondary">Shop slug</span>
              <input disabled={loading} value={shopSlug} onChange={(event) => setShopSlug(event.target.value)} className="w-full rounded-2xl border border-border bg-surface px-4 py-3 outline-none focus:border-primary/60" required />
            </label>
            <label className="space-y-2 text-sm md:col-span-2">
              <span className="text-textSecondary">Description</span>
              <textarea disabled={loading} value={shopDescription} onChange={(event) => setShopDescription(event.target.value)} rows={5} className="w-full rounded-2xl border border-border bg-surface px-4 py-3 outline-none focus:border-primary/60" />
            </label>
            <label className="space-y-2 text-sm md:col-span-2">
              <span className="text-textSecondary">Banner URL</span>
              <input disabled={loading} value={shopBannerURL} onChange={(event) => setShopBannerURL(event.target.value)} className="w-full rounded-2xl border border-border bg-surface px-4 py-3 outline-none focus:border-primary/60" />
            </label>
          </div>
        </section>
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h3 className="text-base font-semibold text-textPrimary">Payouts</h3>
          <div className="mt-5 space-y-4">
            <label className="space-y-2 text-sm">
              <span className="text-textSecondary">Payout method</span>
              <select disabled={loading} value={payoutMethod} onChange={(event) => setPayoutMethod(event.target.value)} className="w-full rounded-2xl border border-border bg-background px-4 py-3 outline-none focus:border-primary/60">
                <option value="">Not configured</option>
                <option value="paypal">PayPal</option>
                <option value="bank">Bank transfer</option>
                <option value="crypto">Crypto</option>
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-textSecondary">Payout account</span>
              <input disabled={loading} value={payoutAccount} onChange={(event) => setPayoutAccount(event.target.value)} className="w-full rounded-2xl border border-border bg-surface px-4 py-3 outline-none focus:border-primary/60" />
            </label>
            <div className="rounded-2xl border border-border bg-elevated p-4">
              <div className="flex items-center gap-3">
                <Store className="size-5 text-primary" />
                <div>
                  <p className="text-sm font-medium text-textPrimary">{shopName || "Store preview"}</p>
                  <p className="text-xs text-textSecondary">/sellers/{shopSlug || "your-shop"}</p>
                </div>
              </div>
              <p className="mt-4 line-clamp-4 text-sm leading-6 text-textSecondary">{shopDescription || "Your public seller description will appear here."}</p>
            </div>
            <button type="submit" disabled={saving || loading} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save settings
            </button>
          </div>
        </section>
      </form>
    </section>
  );
}
