"use client";

import { useEffect, useState } from "react";
import { Loader2, Star, X } from "lucide-react";
import { createProductReview } from "@/lib/api";

const ratingLabels = ["Terrible", "Poor", "Average", "Good", "Excellent"];

function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "response" in error) {
    const response = (error as { response?: { data?: { error?: unknown } } }).response;
    if (typeof response?.data?.error === "string") return response.data.error;
  }
  return "Review could not be submitted.";
}

export function ProductReviewDialog({
  open,
  slug,
  orderID,
  productTitle,
  onClose,
  onSubmitted,
}: {
  open: boolean;
  slug: string;
  orderID: string;
  productTitle: string;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, onClose, open]);

  if (!open) return null;

  const submit = async () => {
    if (rating < 1 || body.trim().length < 20 || busy) return;
    setBusy(true);
    setError("");
    try {
      await createProductReview(slug, { rating, body: body.trim(), order_id: orderID });
      setRating(0);
      setBody("");
      onSubmitted();
    } catch (submitError) {
      setError(errorMessage(submitError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="review-dialog-title" className="w-full max-w-xl rounded-lg border border-border bg-[var(--bg-panel)] shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 id="review-dialog-title" className="text-base font-semibold text-textPrimary">Review {productTitle}</h2>
            <p className="mt-1 text-xs text-textSecondary">Use reviews for product feedback rather than support requests.</p>
          </div>
          <button type="button" title="Close review" aria-label="Close review" disabled={busy} onClick={onClose} className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border text-textSecondary hover:text-textPrimary disabled:opacity-50">
            <X className="size-4" />
          </button>
        </header>

        <div className="space-y-5 p-5">
          <fieldset>
            <legend className="text-sm font-medium text-textPrimary">Rating</legend>
            <div className="mt-3 flex items-center gap-2" role="radiogroup" aria-label="Product rating">
              {ratingLabels.map((label, index) => {
                const value = index + 1;
                const selected = value <= rating;
                return (
                  <button key={label} type="button" role="radio" aria-checked={rating === value} aria-label={`${value} stars, ${label}`} title={label} onClick={() => setRating(value)} className={`inline-flex size-10 items-center justify-center rounded-md border transition ${selected ? "border-warning/50 bg-warning/10 text-warning" : "border-border text-textSecondary hover:border-warning/40 hover:text-warning"}`}>
                    <Star className="size-5" fill={selected ? "currentColor" : "none"} />
                  </button>
                );
              })}
              <span className="ml-2 text-sm text-textSecondary">{rating ? ratingLabels[rating - 1] : "Select rating"}</span>
            </div>
          </fieldset>

          <label className="block">
            <span className="text-sm font-medium text-textPrimary">Review</span>
            <textarea value={body} onChange={(event) => setBody(event.target.value.slice(0, 5000))} rows={5} placeholder="Explain why you are giving this rating." className="mt-2 w-full resize-y rounded-md border border-border bg-elevated px-3 py-2 text-sm leading-6 text-textPrimary outline-none focus:border-primary" />
            <span className={`mt-1 block text-xs ${body.trim().length > 0 && body.trim().length < 20 ? "text-warning" : "text-textSecondary"}`}>{body.trim().length}/5000 · Minimum 20 characters</span>
          </label>

          {error ? <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}
        </div>

        <footer className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <button type="button" disabled={busy} onClick={onClose} className="inline-flex h-10 items-center justify-center rounded-md border border-border px-4 text-sm text-textSecondary hover:text-textPrimary disabled:opacity-50">Cancel</button>
          <button type="button" disabled={busy || rating < 1 || body.trim().length < 20} onClick={() => void submit()} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Star className="size-4" />}
            {busy ? "Submitting..." : "Submit review"}
          </button>
        </footer>
      </section>
    </div>
  );
}
