"use client";

import Image from "next/image";
import Link from "next/link";
import { CreditCard, Loader2, PackageOpen, ShoppingBag, TicketPercent, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { PriceDisplay } from "@/components/common/PriceDisplay";
import {
  createTebexCheckout,
  fetchCart,
  fetchPublicSettings,
  removeFromCart,
  type CartProductItem,
  verifyTebexCheckout,
} from "@/lib/api";

type CheckoutState = "idle" | "creating" | "open" | "verifying";

function hasTebexPackage(item: CartProductItem): boolean {
  const packageId = item.product.metadata?.tebex_package_id;
  if (typeof packageId === "number") return Number.isInteger(packageId) && packageId > 0;
  return typeof packageId === "string" && /^\d+$/.test(packageId) && Number(packageId) > 0;
}

function apiErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "response" in error) {
    const response = (error as { response?: { data?: { error?: unknown } } }).response;
    if (typeof response?.data?.error === "string") return response.data.error;
  }
  return "Checkout could not be started. Try again in a moment.";
}

async function verifyWithRetry(orderId: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await verifyTebexCheckout(orderId);
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => window.setTimeout(resolve, 1200 * (attempt + 1)));
    }
  }
  throw lastError;
}

export default function CartPage() {
  const [items, setItems] = useState<CartProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tebexEnabled, setTebexEnabled] = useState(false);
  const [activeProduct, setActiveProduct] = useState<string | null>(null);
  const [checkoutState, setCheckoutState] = useState<CheckoutState>("idle");
  const [couponCodes, setCouponCodes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const unsubscribeRef = useRef<Array<() => void>>([]);
  const verifyingRef = useRef(false);

  const clearSubscriptions = useCallback(() => {
    unsubscribeRef.current.forEach((unsubscribe) => unsubscribe());
    unsubscribeRef.current = [];
  }, []);

  const loadCart = useCallback(async () => {
    try {
      const [cart, settings] = await Promise.all([fetchCart(), fetchPublicSettings()]);
      setItems(cart);
      setTebexEnabled(Boolean(settings.tebex_checkout_enabled));
    } catch (loadError) {
      setError(apiErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCart();
    return clearSubscriptions;
  }, [clearSubscriptions, loadCart]);

  const remove = async (productId: string) => {
    setError(null);
    try {
      await removeFromCart(productId);
      setItems((current) => current.filter((item) => item.product_id !== productId));
    } catch (removeError) {
      setError(apiErrorMessage(removeError));
    }
  };

  const checkout = async (item: CartProductItem) => {
    setActiveProduct(item.product_id);
    setCheckoutState("creating");
    verifyingRef.current = false;
    setError(null);
    clearSubscriptions();
    try {
      const session = await createTebexCheckout(item.product_id, couponCodes[item.product_id]);
      if (session.status === "completed") {
        setItems((current) => current.filter((entry) => entry.product_id !== item.product_id));
        window.location.assign("/dashboard/purchases");
        return;
      }
      const Tebex = (await import("@tebexio/tebex.js")).default;
      Tebex.checkout.init({
        ident: session.ident,
        theme: "dark",
        colors: [{ name: "primary", color: "#2d8ac8" }],
        closeOnEsc: true,
        closeOnClickOutside: false,
        closeOnPaymentComplete: true,
      });
      unsubscribeRef.current = [
        Tebex.checkout.on("open", () => setCheckoutState("open")),
        Tebex.checkout.on("close", () => {
          if (!verifyingRef.current) {
            setCheckoutState("idle");
            setActiveProduct(null);
          }
        }),
        Tebex.checkout.on("payment:error", () => {
          setError("Tebex could not process that payment method. Try another method.");
        }),
        Tebex.checkout.on("payment:complete", () => {
          verifyingRef.current = true;
          setCheckoutState("verifying");
          void verifyWithRetry(session.id)
            .then(() => {
              setItems((current) => current.filter((entry) => entry.product_id !== item.product_id));
              window.location.assign("/dashboard/purchases");
            })
            .catch((verifyError) => {
              verifyingRef.current = false;
              setError(apiErrorMessage(verifyError));
              setCheckoutState("idle");
              setActiveProduct(null);
            });
        }),
      ];
      await Tebex.checkout.launch();
    } catch (checkoutError) {
      verifyingRef.current = false;
      setError(apiErrorMessage(checkoutError));
      setCheckoutState("idle");
      setActiveProduct(null);
      clearSubscriptions();
    }
  };

  if (loading) {
    return <main className="py-12 text-center text-sm text-textSecondary">Loading cart...</main>;
  }

  return (
    <main className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase text-primary">Checkout</p>
          <h1 className="mt-2 text-2xl font-semibold">Your cart</h1>
        </div>
        <span className="text-sm text-textSecondary">{items.length} {items.length === 1 ? "item" : "items"}</span>
      </div>

      {error ? <div className="border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div> : null}
      {!tebexEnabled && items.length > 0 ? (
        <div className="border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Tebex Headless checkout is not configured.
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="border border-border bg-surface px-6 py-12 text-center">
          <PackageOpen className="mx-auto size-8 text-textSecondary" />
          <p className="mt-4 font-medium">Your cart is empty</p>
          <Link href="/products" className="mt-4 inline-flex items-center gap-2 text-sm text-primary hover:underline">
            <ShoppingBag className="size-4" /> Browse products
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {items.map((item) => {
            const busy = activeProduct === item.product_id && checkoutState !== "idle";
            const packageLinked = hasTebexPackage(item);
            return (
              <article key={item.id} className="overflow-hidden border border-border bg-surface">
                <Link href={`/products/${item.product.slug}`} className="relative block aspect-[16/7] bg-elevated">
                  {item.product.thumbnail_url ? (
                    <Image src={item.product.thumbnail_url} alt={item.product.title} fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
                  ) : (
                    <span className="flex size-full items-center justify-center text-textSecondary"><PackageOpen className="size-8" /></span>
                  )}
                </Link>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <Link href={`/products/${item.product.slug}`} className="line-clamp-1 font-semibold hover:text-primary">{item.product.title}</Link>
                      <p className="mt-1 line-clamp-2 text-sm text-textSecondary">{item.product.short_description}</p>
                    </div>
                    <PriceDisplay value={item.product.price} className="shrink-0 text-lg" />
                  </div>
                  {tebexEnabled && packageLinked ? (
                    <label className="mt-5 flex h-10 items-center gap-2 border border-border bg-elevated px-3 text-sm focus-within:border-primary">
                      <TicketPercent className="size-4 shrink-0 text-textSecondary" />
                      <span className="sr-only">Tebex coupon code</span>
                      <input
                        value={couponCodes[item.product_id] || ""}
                        onChange={(event) => setCouponCodes((current) => ({ ...current, [item.product_id]: event.target.value }))}
                        placeholder="Coupon code"
                        className="min-w-0 flex-1 bg-transparent text-textPrimary outline-none placeholder:text-textSecondary"
                      />
                    </label>
                  ) : null}
                  {!packageLinked ? <p className="mt-4 text-xs text-warning">Tebex package not linked</p> : null}
                  <div className="mt-4 flex gap-2 border-t border-border pt-4">
                    <button
                      type="button"
                      onClick={() => void checkout(item)}
                      disabled={busy || !tebexEnabled || !packageLinked}
                      className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
                    >
                      {busy ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
                      {busy
                        ? checkoutState === "verifying" ? "Verifying..." : "Opening..."
                        : tebexEnabled && packageLinked ? "Checkout with Tebex" : "Checkout unavailable"}
                    </button>
                    <button type="button" onClick={() => void remove(item.product_id)} disabled={busy} aria-label={`Remove ${item.product.title}`} className="inline-flex size-10 items-center justify-center rounded border border-border text-textSecondary hover:text-danger disabled:opacity-50">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
