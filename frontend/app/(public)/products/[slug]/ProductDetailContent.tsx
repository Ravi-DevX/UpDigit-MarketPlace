import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  ExternalLink,
  FileArchive,
  History,
  MessageSquare,
  PackageCheck,
  ShieldCheck,
  Tag,
  UserRound,
} from "lucide-react";
import { fetchProductBySlug, fetchProductMedia, fetchProductReviews, fetchProducts, fetchProductVersions, fetchPublicSettings } from "@/lib/api";
import { toArray } from "@/lib/payload";
import type { Product, ProductMedia, ProductVersion, Review } from "@/types/marketplace";
import { RatingStars } from "@/components/common/RatingStars";
import { ProductActionButton } from "@/components/product/ProductActionButton";
import { ProductMediaCarousel } from "@/components/product/ProductMediaCarousel";
import { ReviewList } from "@/components/review/ReviewList";
import { InfoHelpButton } from "@/components/product/InfoHelpButton";
import { ProductVersionActions } from "@/components/product/ProductVersionActions";
import { ProductResourceTabs } from "@/components/product/ProductResourceTabs";

export type ProductResourceTab = "overview" | "dependencies" | "updates" | "reviews" | "history";

export function normalizeProductTab(tab?: string): ProductResourceTab {
  if (tab === "dependencies" || tab === "updates" || tab === "reviews" || tab === "history") {
    return tab;
  }
  return "overview";
}

async function loadProduct(slug: string): Promise<Product> {
  let lastError: unknown;
  const delays = [200, 400, 800, 1200];
  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    try {
      return await fetchProductBySlug(slug);
    } catch (error) {
      lastError = error;
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 404 || attempt === delays.length) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
    }
  }
  throw lastError;
}

export const getProduct = loadProduct;

function formatDate(value?: string | null) {
  if (!value) {
    return "Unknown";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown"
    : new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function formatCount(value?: number) {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value || 0);
}

function formatBytes(value?: number | null) {
  if (!value || value <= 0) {
    return "Unknown";
  }
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unit]}`;
}

function titleCaseTag(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function metadataText(product: Product, key: string) {
  const value = product.metadata?.[key];
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "string").join(" ");
  }
  return "";
}

function metadataBool(product: Product, key: string) {
  const value = product.metadata?.[key];
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  return "No";
}

function dependencies(product: Product) {
  const raw = product.metadata?.dependencies;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((item) => {
      if (typeof item === "string") {
        return { name: item, link: "" };
      }
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        return {
          name: typeof record.name === "string" ? record.name : "",
          link: typeof record.link === "string" ? record.link : "",
        };
      }
      return { name: "", link: "" };
    })
    .filter((item) => item.name);
}

export async function ProductDetailContent({ slug, activeTab, initialProduct }: { slug: string; activeTab: ProductResourceTab; initialProduct?: Product }) {
  const product = initialProduct ?? await getProduct(slug).catch(() => notFound());
  const [reviewsResult, versionsResult, relatedResult, settings, mediaResult] = await Promise.all([
    fetchProductReviews(product.slug).catch(() => []),
    fetchProductVersions(product.slug).catch(() => []),
    fetchProducts({ category: product.category?.slug ?? product.category_id ?? undefined, limit: 6 }).catch(() => []),
    fetchPublicSettings().catch(() => null),
    fetchProductMedia(product.slug).catch(() => []),
  ]);
  const reviews = toArray<Review>(reviewsResult, ["reviews", "data", "items", "results"]);
  const versions = toArray<ProductVersion>(versionsResult, ["versions", "data", "items", "results"]);
  const publicUpdates = versions.filter((version) => version.is_update_posted ?? Boolean(version.update_title || version.changelog));
  const related = toArray<Product>(relatedResult, ["products", "data", "items", "results"])
    .filter((item) => item.slug !== product.slug)
    .slice(0, 3);
  const priceValue = typeof product.price === "number" ? product.price : Number(product.price || 0);
  const latestVersion = product.version ?? versions.find((version) => version.is_latest)?.version_tag ?? versions[0]?.version_tag;
  const latestFileSize = versions.find((version) => version.is_latest)?.file_size ?? versions[0]?.file_size;
  const categoryName = product.category?.name ?? "Marketplace resource";
  const tags = (product.tags ?? []).filter(Boolean);
  const dependencyItems = dependencies(product);
  const reviewCount = product.review_count || reviews.length;
  const announcement = settings?.announcement_text?.trim();
  const media = toArray<ProductMedia>(mediaResult, ["media", "data", "items", "results"]);
  const galleryURLs = media.filter((item) => item.media_type === "gallery").map((item) => item.media_url);
  const showCover = metadataBool(product, "display_cover_on_product_page") !== "No";
  const carouselEnabled = metadataBool(product, "carousel_enabled") !== "No";
  const useTextCover = metadataText(product, "cover_mode") === "text";
  const videoEnabled = metadataBool(product, "video_demo_enabled") !== "No" && Boolean(product.demo_url);

  return (
    <main className="space-y-5">
      <nav className="flex flex-wrap items-center gap-2 text-sm text-textSecondary">
        <Link href="/products" className="hover:text-textPrimary">
          Resources
        </Link>
        <ArrowRight className="size-4" />
        {product.category?.slug ? (
          <>
            <Link href={`/products?category=${product.category.slug}`} className="hover:text-textPrimary">
              {product.category.name}
            </Link>
            <ArrowRight className="size-4" />
          </>
        ) : null}
        <span className="text-textPrimary">{product.title}</span>
      </nav>

      <section className="border-b border-border pb-5">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap gap-2">
            {product.is_featured ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning/15 px-3 py-1 text-xs text-warning">
                <PackageCheck className="size-3.5" />
                Featured
              </span>
            ) : null}
            {product.is_exclusive ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/15 px-3 py-1 text-xs text-success">
                <ShieldCheck className="size-3.5" />
                Exclusive
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1 text-xs text-textSecondary">
              <Tag className="size-3.5" />
              {categoryName}
            </span>
          </div>
          <h1 className="text-3xl font-semibold leading-tight text-textPrimary sm:text-4xl">
            {product.title}
            {latestVersion ? <span className="text-textSecondary"> v{latestVersion}</span> : null}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-textSecondary">{product.short_description}</p>
          {announcement ? (
            <p className="mt-3 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">{announcement}</p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-textSecondary">
            <span className="inline-flex items-center gap-2">
              <UserRound className="size-4 text-primary" />
              {product.seller?.username ?? "Creator"}
            </span>
            <span className="inline-flex items-center gap-2">
              <CalendarDays className="size-4 text-primary" />
              Updated {formatDate(product.updated_at)}
            </span>
            <RatingStars value={product.average_rating || 0} />
          </div>
        </div>
      </section>

      <div className="resource-layout-grid">
        <ProductResourceTabs
          slug={product.slug}
          initialTab={activeTab}
          updateCount={publicUpdates.length}
          reviewCount={reviewCount}
          overview={
            <article className="rounded-lg border border-border bg-elevated p-5 sm:p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-textPrimary">Overview</h2>
                {product.demo_url && !videoEnabled ? (
                  <a
                    href={product.demo_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-textSecondary transition hover:border-primary/40 hover:text-textPrimary"
                  >
                    Demo <ExternalLink className="size-4" />
                  </a>
                ) : null}
              </div>
              <ProductMediaCarousel
                title={product.title}
                coverURL={showCover ? product.banner_url || product.thumbnail_url : null}
                galleryURLs={carouselEnabled ? galleryURLs : []}
                useTextCover={showCover && useTextCover}
                videoURL={videoEnabled ? product.demo_url : null}
              />
              <div
                className="rich-content max-w-none text-sm text-textSecondary"
                dangerouslySetInnerHTML={{ __html: product.description || "<p>No description has been added yet.</p>" }}
              />
            </article>
          }

          dependencies={
            <section className="rounded-lg border border-border bg-elevated p-5 sm:p-6">
              <h2 className="text-xl font-semibold text-textPrimary">Dependencies</h2>
              {dependencyItems.length > 0 ? (
                <div className="mt-4 divide-y divide-white/10 rounded-lg border border-border">
                  {dependencyItems.map((item) => (
                    <div key={`${item.name}-${item.link}`} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <span className="font-medium text-textPrimary">{item.name}</span>
                      {item.link ? (
                        <a href={item.link} target="_blank" rel="noreferrer" className="text-sm text-primary hover:text-textPrimary">
                          Open dependency
                        </a>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 rounded-lg border border-border bg-surface p-4 text-sm text-textSecondary">
                  No dependencies have been listed for this product.
                </p>
              )}
            </section>
          }

          updates={
            <section className="rounded-lg border border-border bg-elevated p-5 sm:p-6">
              <div className="mb-4 flex items-center gap-2">
                <FileArchive className="size-5 text-primary" />
                <h2 className="text-xl font-semibold text-textPrimary">Updates</h2>
              </div>
              <VersionList versions={publicUpdates} />
            </section>
          }

          reviews={
            <section className="rounded-lg border border-border bg-elevated p-5 sm:p-6">
              <div className="mb-4 flex items-center gap-2">
                <MessageSquare className="size-5 text-primary" />
                <h2 className="text-xl font-semibold text-textPrimary">Reviews</h2>
              </div>
              <ReviewList reviews={reviews} />
            </section>
          }

          history={
            <section className="rounded-lg border border-border bg-elevated p-5 sm:p-6">
              <div className="mb-4 flex items-center gap-2">
                <History className="size-5 text-primary" />
                <h2 className="text-xl font-semibold text-textPrimary">History</h2>
              </div>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="min-w-full divide-y divide-white/10 text-sm">
                  <thead className="bg-elevated text-left text-textSecondary">
                    <tr>
                      <th className="px-4 py-3 font-medium">Version</th>
                      <th className="px-4 py-3 font-medium">Release date</th>
                      <th className="px-4 py-3 font-medium">Downloads</th>
                      <th className="px-4 py-3 font-medium">Rating</th>
                      <th className="px-4 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {(versions.length > 0 ? versions : [{ id: "current", version_tag: latestVersion || "1.0.0", created_at: product.created_at, is_latest: true }] as ProductVersion[]).map((version) => (
                      <tr key={version.id}>
                        <td className="px-4 py-3 font-medium text-textPrimary">v{version.version_tag}{version.update_title ? ` | ${version.update_title}` : ""}</td>
                        <td className="px-4 py-3 text-textSecondary">{formatDate(version.created_at)}</td>
                        <td className="px-4 py-3 text-textSecondary">{formatCount(version.download_count || 0)}</td>
                        <td className="px-4 py-3 text-textSecondary">{product.average_rating > 0 ? `${product.average_rating.toFixed(2)} star(s)` : "Not yet rated"}</td>
                        <td className="px-4 py-3">{version.id !== "current" ? <ProductVersionActions slug={product.slug} versionId={version.id} sellerId={product.seller_id} isLatest={Boolean(version.is_latest)} /> : null}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          }
        />

        <aside className="resource-sidebar">
          {product.status === "approved" ? (
            <ProductActionButton productId={product.id} slug={product.slug} price={priceValue} sellerId={product.seller_id} productTitle={product.title} currentVersion={latestVersion} />
          ) : (
            <section className="resource-sidebar-group">
              <button disabled className="inline-flex h-11 w-full items-center justify-center rounded-md border border-border text-sm text-textSecondary">
                Draft preview
              </button>
            </section>
          )}

          <section className="resource-sidebar-group">
            <div className={`resource-info-row ${product.total_sales > 0 ? "resource-info-row--three" : "resource-info-row--two"}`}>
              <Metric label="Views" value={formatCount(Number(product.metadata?.views) || 0)} />
              {product.total_sales > 0 ? <Metric label="Purchases" value={formatCount(product.total_sales)} /> : null}
              <Metric label="Downloads" value={formatCount(product.total_downloads)} />
            </div>
            <div className="resource-info-row resource-info-row--two">
              <Metric label="Published" value={formatDate(product.created_at)} />
              <Metric label="Updated" value={formatDate(product.updated_at)} />
            </div>
            <div className="resource-info-row resource-info-row--two">
              <Metric label="Average rating" value={product.average_rating > 0 ? `${product.average_rating.toFixed(2)} (${reviewCount})` : "Not yet rated"} />
              <Metric label="File size" value={formatBytes(latestFileSize)} />
            </div>
            {tags.length > 0 ? (
              <div className="resource-info-row">
                <div className="resource-info-bubble resource-info-bubble--wide flex flex-wrap justify-center gap-2">
                {tags.map((tag) => (
                  <Link key={tag} href={`/products?tags=${encodeURIComponent(tag)}`} className="rounded border border-border bg-elevated px-2 py-1 text-xs text-textSecondary hover:border-primary/40 hover:text-textPrimary">
                    {titleCaseTag(tag)}
                  </Link>
                ))}
                </div>
              </div>
            ) : null}
            <div className="resource-info-row">
              <div className="resource-info-bubble resource-info-bubble--wide space-y-3 text-sm">
                <InfoRow
                  label="Open source"
                  value={metadataBool(product, "open_source")}
                  help={{
                    title: "What does open source mean?",
                    description: "An open-source product makes its source code publicly accessible so users can inspect, modify, and contribute to it. A product marked No keeps its source code private or limits access to licensed users.",
                  }}
                />
                <InfoRow
                  label="DRM-free"
                  value={metadataBool(product, "drm_free")}
                  help={{
                    title: "What does DRM-free mean?",
                    description: "A DRM-free product has no license checks, device restrictions, remote activation, IP reporting, or similar controls intended to prevent unauthorized use. Products marked No may include one or more of those systems.",
                  }}
                />
                <InfoRow
                  label="Unobfuscated"
                  value={metadataBool(product, "unobfuscated")}
                  help={{
                    title: "What does unobfuscated mean?",
                    description: "An unobfuscated product has not been intentionally transformed to make its source or compiled logic difficult to understand. A product marked No may use obfuscation to protect its implementation.",
                  }}
                />
              </div>
            </div>
            <div className="resource-info-row">
              <div className="resource-info-bubble resource-info-bubble--wide space-y-3 text-sm">
                <InfoRow label="Type" value={metadataText(product, "types") || categoryName} />
                <InfoRow label="Game mode" value={metadataText(product, "game_modes") || tags.slice(0, 3).map(titleCaseTag).join(" ")} />
                <InfoRow label="Supported software" value={metadataText(product, "supported_software") || tags.filter((tag) => ["spigot", "paper", "folia", "purpur", "velocity", "bungeecord"].includes(tag)).map(titleCaseTag).join(" ")} />
                <InfoRow label="Supported versions" value={(product.supported_versions ?? []).join(" ") || "Not specified"} />
                <InfoRow label="Supported languages" value={metadataText(product, "supported_languages") || "English"} />
                <InfoRow label="Versions" value={String(versions.length || (latestVersion ? 1 : 0))} />
              </div>
            </div>
          </section>

          {product.seller ? (
            <section className="resource-sidebar-group">
              <p className="resource-sidebar-title">Creator</p>
              <div className="mt-2 flex items-center gap-3">
                {product.seller.avatar_url ? <img src={product.seller.avatar_url} alt={product.seller.username} loading="lazy" decoding="async" className="size-11 rounded-md object-cover" /> : <span className="flex size-11 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">{(product.seller.username || "S").slice(0, 2).toUpperCase()}</span>}
                <div className="min-w-0">
                  <Link href={`/sellers/${product.seller.username}`} className="truncate font-medium text-textPrimary hover:text-primary">
                    {product.seller.seller_profile?.shop_name || product.seller.username}
                  </Link>
                  <p className="text-xs text-textSecondary">Owner</p>
                </div>
              </div>
            </section>
          ) : null}

          {related.length > 0 ? (
            <section className="resource-sidebar-group">
              <h3 className="resource-sidebar-title">Recommended for you</h3>
              <div className="divide-y divide-white/10">
                {related.map((relatedProduct) => (
                  <Link
                    key={relatedProduct.id}
                    href={`/products/${relatedProduct.slug}`}
                    className="flex gap-3 py-3 transition first:pt-1 last:pb-0 hover:text-primary"
                  >
                    <img src={relatedProduct.banner_url || relatedProduct.thumbnail_url || "/placeholder-product.png"} alt={relatedProduct.title} loading="lazy" decoding="async" className="h-14 w-24 shrink-0 rounded-md object-cover" />
                    <span className="min-w-0">
                      <span className="line-clamp-2 text-sm font-medium text-textPrimary">{relatedProduct.title}</span>
                      <span className="mt-1 block text-xs text-textSecondary">
                        {relatedProduct.price > 0 ? `$${relatedProduct.price.toFixed(2)}` : "Free"}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </main>
  );
}

function VersionList({ versions }: { versions: ProductVersion[] }) {
  if (versions.length === 0) {
    return <p className="rounded-lg border border-border bg-surface p-4 text-sm text-textSecondary">No public updates are available yet.</p>;
  }
  return (
    <div className="divide-y divide-white/10 rounded-lg border border-border">
      {versions.map((version) => (
        <article key={version.id} className="p-4">
          <h3 className="text-base font-semibold text-textPrimary">{version.update_title || "Product update"}</h3>
          <p className="mt-1 text-xs text-textSecondary">{formatDate(version.created_at)}</p>
          {version.changelog ? (
            <div className="rich-content mt-3 text-sm text-textSecondary" dangerouslySetInnerHTML={{ __html: version.changelog }} />
          ) : null}
        </article>
      ))}
    </div>
  );
}

function InfoRow({ label, value, help }: { label: string; value?: string; help?: { title: string; description: string } }) {
  if (!value) {
    return null;
  }
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-textSecondary">{label}</span>
      <span className="flex max-w-[160px] items-start justify-end gap-1 break-words text-right font-medium text-textPrimary">
        <span>{value}</span>
        {help ? <InfoHelpButton title={help.title} description={help.description} /> : null}
      </span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="resource-info-bubble">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
