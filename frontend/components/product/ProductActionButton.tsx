"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Download, Loader2, MessageSquare, Pencil, ShoppingCart, Star, UploadCloud } from "lucide-react";
import { addToCart, createConversation, downloadFreeProduct, downloadOwnerProduct, fetchOrderDownload, fetchProductEntitlement, requestDgenLogin } from "@/lib/api";
import type { ProductEntitlement } from "@/types/marketplace";
import { useAuthStore } from "@/store/auth";
import { ProductUpdateModal } from "@/components/product/ProductUpdateModal";
import { PriceDisplay } from "@/components/common/PriceDisplay";
import { InfoHelpButton } from "@/components/product/InfoHelpButton";
import { ProductReviewDialog } from "@/components/review/ProductReviewDialog";

const eulaDescription = "This product uses the marketplace EULA shown before download or purchase. The license defines permitted usage, redistribution restrictions, support expectations, and the rights retained by the creator.";

export function ProductActionButton({
  productId,
  slug,
  price,
  sellerId,
  productTitle,
  currentVersion,
}: {
  productId: string;
  slug: string;
  price: number;
  sellerId: string;
  productTitle: string;
  currentVersion?: string | null;
}) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasCheckedSession = useAuthStore((state) => state.hasCheckedSession);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [updateOpen, setUpdateOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageBody, setMessageBody] = useState("");
  const [messageBusy, setMessageBusy] = useState(false);
  const [entitlement, setEntitlement] = useState<ProductEntitlement | null>(null);
  const [entitlementLoading, setEntitlementLoading] = useState(true);
  const isFree = price <= 0;
  const user = useAuthStore((state) => state.user);
  const isOwner = user?.id === sellerId;

  useEffect(() => {
    let mounted = true;
    if (!hasCheckedSession || !isAuthenticated || isFree || isOwner) {
      setEntitlementLoading(false);
      setEntitlement(null);
      return () => {
        mounted = false;
      };
    }
    setEntitlementLoading(true);
    fetchProductEntitlement(slug)
      .then((payload) => {
        if (mounted) setEntitlement(payload);
      })
      .catch(() => {
        if (mounted) setEntitlement(null);
      })
      .finally(() => {
        if (mounted) setEntitlementLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [hasCheckedSession, isAuthenticated, isFree, isOwner, slug]);

  if (!hasCheckedSession) {
    return <div className="resource-sidebar-group h-24 animate-pulse bg-elevated" aria-label="Loading product actions" />;
  }

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      if (isFree) {
        const payload = await downloadFreeProduct(slug);
        window.location.href = payload.download_url;
        return;
      }
      if (!isAuthenticated) {
        requestDgenLogin(`/products/${slug}`);
        return;
      }
      await addToCart(productId);
      router.push("/cart");
    } catch {
      setError(isFree ? "Download is not available yet." : "Could not add this product to cart.");
    } finally {
      setBusy(false);
    }
  };

  const ownerDownload = async () => {
    setBusy(true);
    setError("");
    try {
      const payload = await downloadOwnerProduct(slug);
      const url = URL.createObjectURL(payload.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = payload.fileName;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("No release file is available to download.");
    } finally {
      setBusy(false);
    }
  };

  const buyerDownload = async () => {
    if (!entitlement?.order_id) return;
    setBusy(true);
    setError("");
    try {
      const payload = await fetchOrderDownload(entitlement.order_id);
      const anchor = document.createElement("a");
      anchor.href = payload.download_url;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 900 + attempt * 350));
        const current = await fetchProductEntitlement(slug);
        setEntitlement(current);
        if (current.downloaded) break;
      }
    } catch {
      setError("Download is not available yet.");
    } finally {
      setBusy(false);
    }
  };

  const messageSeller = async () => {
    if (!isAuthenticated) {
      requestDgenLogin(`/products/${slug}`);
      return;
    }
    const body = messageBody.trim();
    if (body.length < 3) {
      setError("Write a short message before contacting the seller.");
      return;
    }
    setMessageBusy(true);
    setError("");
    try {
      const conversation = await createConversation({
        title: `Question about ${productTitle}`,
        body,
        recipient_ids: [sellerId],
        context_type: "product",
        context_id: productId,
      });
      router.push(`/dashboard/conversations/${conversation.id}`);
    } catch {
      setError("Could not start a seller conversation.");
    } finally {
      setMessageBusy(false);
    }
  };

  const sellerContactPanel = (
    <div className="mt-3 border-t border-border pt-3">
      {messageOpen ? (
        <div className="grid gap-2">
          <textarea
            value={messageBody}
            onChange={(event) => setMessageBody(event.target.value)}
            rows={3}
            maxLength={10000}
            className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/60"
            placeholder="Ask the seller a question..."
          />
          <button
            type="button"
            disabled={messageBusy || !messageBody.trim()}
            onClick={() => void messageSeller()}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-primary/40 bg-primary/10 text-sm font-medium text-primary hover:bg-primary/15 disabled:opacity-50"
          >
            {messageBusy ? <Loader2 className="size-4 animate-spin" /> : <MessageSquare className="size-4" />}
            Send message
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setMessageOpen(true)}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-border bg-[var(--bg-panel)] text-sm text-textPrimary hover:border-primary/50"
        >
          <MessageSquare className="size-4" />
          Message seller
        </button>
      )}
    </div>
  );

  if (isOwner) {
    return (
      <>
        <div className="resource-sidebar-actions">
          <Link href={`/seller/products/${slug}/edit`} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md border border-border bg-[var(--bg-panel)] text-sm text-textPrimary hover:border-primary/50"><Pencil className="size-4" /> Edit</Link>
          <button type="button" onClick={() => setUpdateOpen(true)} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-[var(--accent-hover)]"><UploadCloud className="size-4" /> Update</button>
        </div>
        <div className="resource-sidebar-group resource-download-group">
          <button type="button" disabled={busy} onClick={() => void ownerDownload()} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-primary/40 bg-primary/10 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} {busy ? "Preparing..." : "Download now"}
          </button>
          <div className="mt-3 flex items-center justify-center gap-1 border-t border-border pt-3 text-xs text-textSecondary">
            <span>EULA: Standard EULA</span>
            <InfoHelpButton title="Product license agreement" description={eulaDescription} />
          </div>
          {error ? <p className="text-xs text-danger">{error}</p> : null}
        </div>
        <ProductUpdateModal open={updateOpen} onClose={() => setUpdateOpen(false)} slug={slug} productTitle={productTitle} currentVersion={currentVersion} />
      </>
    );
  }

  if (entitlementLoading) {
    return <div className="resource-sidebar-group h-24 animate-pulse bg-elevated" aria-label="Loading license actions" />;
  }

  if (entitlement?.purchased && entitlement.order_id) {
    return (
      <>
        <section className="resource-sidebar-group resource-download-group">
          <div className="flex gap-2">
            {entitlement.can_review ? (
              <button type="button" disabled={busy} onClick={() => setReviewOpen(true)} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 text-sm font-medium text-primary hover:bg-primary/15 disabled:opacity-50">
                <Star className="size-4" /> Review
              </button>
            ) : null}
            <button type="button" disabled={busy} onClick={() => void buyerDownload()} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-[var(--accent-hover)] disabled:opacity-50">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              {busy ? "Preparing..." : "Download now"}
            </button>
          </div>
          <div className="mt-3 flex items-center justify-center gap-1 border-t border-border pt-3 text-xs text-textSecondary">
            <span>EULA: Standard EULA</span>
            <InfoHelpButton title="Product license agreement" description={eulaDescription} />
          </div>
          {sellerContactPanel}
          {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
        </section>
        <ProductReviewDialog
          open={reviewOpen}
          slug={slug}
          orderID={entitlement.order_id}
          productTitle={productTitle}
          onClose={() => setReviewOpen(false)}
          onSubmitted={() => {
            setReviewOpen(false);
            setEntitlement((current) => current ? { ...current, reviewed: true, can_review: false } : current);
            router.push(`/products/${slug}/reviews`);
            router.refresh();
          }}
        />
      </>
    );
  }

  return (
    <section className="resource-sidebar-group">
      {!isFree ? (
        <>
          <p className="text-sm text-textSecondary">Buy a license now</p>
          <PriceDisplay value={price} className="mt-2 block text-2xl" />
        </>
      ) : null}
      <button
        type="button"
        onClick={() => void run()}
        disabled={busy}
        className={`${isFree ? "" : "mt-4"} inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60`}
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : isFree ? <Download className="size-4" /> : <ShoppingCart className="size-4" />}
        {busy ? "Preparing..." : isFree ? "Download now" : "Add to cart"}
      </button>
      <div className="mt-3 flex items-center justify-center gap-1 border-t border-border pt-3 text-xs text-textSecondary">
        <span>EULA: {isFree ? "Free EULA" : "Standard EULA"}</span>
        <InfoHelpButton title="Product license agreement" description={eulaDescription} />
      </div>
      {sellerContactPanel}
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </section>
  );
}
