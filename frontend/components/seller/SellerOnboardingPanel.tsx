"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, RefreshCw, Send, Store } from "lucide-react";
import { applySeller, fetchMe, fetchSellerApplication, refreshSession } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

export function SellerOnboardingPanel() {
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const [shopName, setShopName] = useState("");
  const [shopSlug, setShopSlug] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"none" | "pending" | "approved">("none");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const suggestedName = useMemo(() => {
    const base = user?.display_name || user?.username || "";
    return base ? `${base}'s Store` : "";
  }, [user]);

  useEffect(() => {
    if (!shopName && suggestedName) {
      setShopName(suggestedName);
      setShopSlug(slugify(suggestedName));
    }
  }, [shopName, suggestedName]);

  useEffect(() => {
    let mounted = true;
    fetchSellerApplication()
      .then((application) => {
        if (!mounted) {
          return;
        }
        setStatus(application.status);
        if (application.profile) {
          setShopName(application.profile.shop_name ?? "");
          setShopSlug(application.profile.shop_slug ?? "");
          setDescription(application.profile.shop_description ?? "");
        }
      })
      .catch(() => {
        if (mounted) {
          setError("Creator access could not be checked.");
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

  const refreshAccess = async () => {
    setRefreshing(true);
    setError("");
    try {
      await refreshSession();
      const me = await fetchMe();
      updateUser(me);
      const application = await fetchSellerApplication();
      setStatus(application.status);
      if (application.status === "approved") {
        window.location.reload();
      }
    } catch {
      setError("Could not refresh creator access.");
    } finally {
      setRefreshing(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const application = await applySeller({
        shop_name: shopName.trim(),
        shop_slug: slugify(shopSlug || shopName),
        shop_description: description.trim() || undefined,
      });
      setStatus(application.status);
      if (application.profile) {
        setShopName(application.profile.shop_name ?? "");
        setShopSlug(application.profile.shop_slug ?? "");
        setDescription(application.profile.shop_description ?? "");
      }
      await refreshAccess();
    } catch {
      setError("Could not submit creator application. Check the shop name and slug.");
    } finally {
      setSubmitting(false);
    }
  };

  const pending = status === "pending";
  const approved = status === "approved";

  return (
    <section className="mx-auto max-w-3xl rounded-panel border border-border bg-surface p-6 shadow-[0_24px_90px_rgba(0,0,0,0.28)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-primary">Creator onboarding</p>
          <h1 className="mt-2 text-2xl font-semibold text-textPrimary">Open your seller studio</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-textSecondary">
            Create a public seller profile first. Once the profile is approved, product publishing, orders, earnings, coupons, and webhooks unlock here.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-elevated px-3 py-1 text-xs text-textSecondary">
          <Store className="size-3 text-primary" />
          {loading ? "Checking" : approved ? "Approved" : pending ? "Pending review" : "Not started"}
        </span>
      </div>

      {error ? <div className="mt-5 rounded-2xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{error}</div> : null}

      {pending || approved ? (
        <div className="mt-6 rounded-2xl border border-border bg-elevated p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 text-success" />
            <div>
              <h2 className="text-base font-semibold text-textPrimary">
                {approved ? "Creator access is approved" : "Creator application submitted"}
              </h2>
              <p className="mt-1 text-sm leading-6 text-textSecondary">
                {approved
                  ? "Refresh your session to enter Seller Studio with the updated role."
                  : "Your seller profile is waiting for review. You can refresh access after approval."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={refreshAccess}
            disabled={refreshing}
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-textPrimary disabled:opacity-60"
          >
            {refreshing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Refresh access
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 grid gap-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="text-textSecondary">Shop name</span>
              <input
                value={shopName}
                onChange={(event) => {
                  setShopName(event.target.value);
                  setShopSlug(slugify(event.target.value));
                }}
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 outline-none focus:border-primary/60"
                required
                minLength={3}
                maxLength={100}
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-textSecondary">Shop slug</span>
              <input
                value={shopSlug}
                onChange={(event) => setShopSlug(slugify(event.target.value))}
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 outline-none focus:border-primary/60"
                required
                minLength={3}
                maxLength={100}
              />
            </label>
          </div>
          <label className="space-y-2 text-sm">
            <span className="text-textSecondary">Shop description</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={5}
              className="w-full rounded-2xl border border-border bg-background px-4 py-3 outline-none focus:border-primary/60"
              placeholder="Tell buyers what you build, support, and sell."
            />
          </label>
          <button
            type="submit"
            disabled={loading || submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground disabled:opacity-60 sm:w-max"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Submit creator application
          </button>
        </form>
      )}
    </section>
  );
}
