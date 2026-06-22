import { Review } from "@/types/marketplace";
import { RatingStars } from "@/components/common/RatingStars";

export function ReviewCard({ review }: { review: Review }) {
  const username = review.user?.username ?? review.user_id ?? "Marketplace user";
  const createdAt = new Date(review.created_at);
  const createdLabel = Number.isNaN(createdAt.getTime())
    ? "Unknown date"
    : createdAt.toLocaleDateString();

  return (
    <article className="rounded border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{username}</p>
          <p className="text-xs text-textSecondary">
            {review.is_verified_purchase ? "Verified purchase" : "Unverified"}
          </p>
        </div>
        <RatingStars value={review.rating} />
      </div>
      {review.title ? <h4 className="mt-2 font-medium">{review.title}</h4> : null}
      {review.body ? <p className="mt-2 text-sm text-textSecondary">{review.body}</p> : null}
      {review.seller_reply ? (
        <p className="mt-3 rounded border border-border bg-surface/80 px-3 py-2 text-xs text-textSecondary">
          Seller reply: {review.seller_reply}
        </p>
      ) : null}
      <p className="mt-3 text-xs text-textSecondary">{createdLabel}</p>
    </article>
  );
}
