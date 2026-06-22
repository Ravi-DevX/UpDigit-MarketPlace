import { Review } from "@/types/marketplace";
import { ReviewCard } from "@/components/review/ReviewCard";
import { toArray } from "@/lib/payload";

export function ReviewList({ reviews }: { reviews: unknown }) {
  const items = toArray<Review>(reviews, ["reviews", "data", "payload", "items", "results", "rows"])
    .filter((review): review is Review => Boolean(review && typeof review === "object"));

  if (!Array.isArray(items)) {
    return (
      <div className="rounded border border-border bg-surface p-6 text-sm text-textSecondary">
        Review feed is temporarily unavailable.
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded border border-border bg-surface p-6 text-sm text-textSecondary">
        No reviews yet. Be the first to review this product.
      </div>
    );
  }

  return (
      <div className="grid gap-4">
      {items.map((review) => (
        <ReviewCard key={review.id} review={review} />
      ))}
    </div>
  );
}
