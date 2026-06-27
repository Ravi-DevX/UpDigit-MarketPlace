import Link from "next/link";
import { Download, MessageSquare, ShieldCheck } from "lucide-react";
import { Product } from "@/types/marketplace";
import { Badge } from "@/components/common/Badge";
import { PriceDisplay } from "@/components/common/PriceDisplay";
import { RatingStars } from "@/components/common/RatingStars";

export function ProductCard({ product }: { product: Product }) {
  const sellerName = product.seller?.seller_profile?.shop_name || product.seller?.display_name || product.seller?.username || "seller";
  const sellerSlug = product.seller?.seller_profile?.shop_slug || product.seller?.username || product.slug;
  return (
    <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-md border border-border bg-surface shadow-[0_18px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl transition hover:-translate-y-1 hover:border-primary/45 hover:bg-elevated hover:shadow-[0_24px_90px_rgba(0,0,0,0.34)]">
      <Link href={`/products/${product.slug}`}>
        <div className="relative aspect-[2/1] overflow-hidden bg-black/25">
          <img
            src={product.banner_url || product.thumbnail_url || "/placeholder-product.png"}
            alt={product.title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]"
          />
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/65 to-transparent" />
          {product.is_exclusive ? (
            <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-success/30 bg-black/55 px-2.5 py-1 text-xs text-success backdrop-blur">
              <ShieldCheck className="size-3" />
              Exclusive
            </span>
          ) : null}
        </div>
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Link href={`/products/${product.slug}`}>
              <h3 className="line-clamp-2 text-base font-semibold leading-tight text-textPrimary">
                {product.title}
              </h3>
            </Link>
            <p className="mt-1 line-clamp-1 text-sm text-textSecondary">
              by{" "}
              <Link className="text-textSecondary hover:text-textPrimary" href={`/sellers/${sellerSlug}`}>
                {sellerName}
              </Link>
            </p>
          </div>
          {product.is_featured ? <Badge tone="success">Featured</Badge> : null}
        </div>
        <p className="line-clamp-2 text-sm text-textSecondary">{product.short_description}</p>
        <div className="flex items-center justify-between">
          <PriceDisplay value={product.price} />
          <RatingStars value={product.average_rating} />
        </div>
        <div className="mt-auto flex items-center justify-between border-t border-border pt-3 text-xs text-textSecondary">
          <span className="inline-flex items-center gap-1">
            <Download className="size-3.5" />
            {product.total_downloads} downloads
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageSquare className="size-3.5" />
            {product.review_count} reviews
          </span>
        </div>
      </div>
    </article>
  );
}
