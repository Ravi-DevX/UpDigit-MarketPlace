import { Metadata } from "next";
import Link from "next/link";
import { Download, Package, Search, ShoppingBag, Star, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { PriceDisplay } from "@/components/common/PriceDisplay";
import { RatingStars } from "@/components/common/RatingStars";
import { fetchCategories, fetchSellerProducts, fetchUserByUsername } from "@/lib/api";
import type { Category, Product } from "@/types/marketplace";

type SellerPageProps = {
  params: { username: string };
  searchParams?: { search?: string; category?: string; sort?: string; page?: string };
};

const sortOptions = [
  { value: "newest", label: "Submission date" },
  { value: "downloaded", label: "Downloads" },
  { value: "rated", label: "Rating" },
  { value: "price_low", label: "Price low to high" },
  { value: "price_high", label: "Price high to low" },
];

export async function generateMetadata({ params }: { params: { username: string } }): Promise<Metadata> {
  const user = await fetchUserByUsername(params.username).catch(() => null);
  const products = await fetchSellerProducts(params.username, { limit: 100 }).catch(() => []);
  const profile = products[0]?.seller?.seller_profile;
  const shopName = profile?.shop_name ?? user?.display_name ?? user?.username ?? params.username;
  return {
    title: `${shopName} | UpDigit Store`,
    description: profile?.shop_description ?? user?.bio ?? "Creator storefront and resources.",
  };
}

export default async function SellerPage({ params, searchParams }: SellerPageProps) {
  const selectedCategory = searchParams?.category || "all";
  const selectedSort = searchParams?.sort || "newest";
  const search = searchParams?.search || "";

  const [user, allProducts, filteredProducts, categories] = await Promise.all([
    fetchUserByUsername(params.username).catch(() => null),
    fetchSellerProducts(params.username, { limit: 100, sort: "newest" }).catch(() => []),
    fetchSellerProducts(params.username, {
      limit: 100,
      sort: selectedSort,
      category: selectedCategory === "all" ? undefined : selectedCategory,
      search: search || undefined,
    }).catch(() => []),
    fetchCategories().catch(() => []),
  ]);

  const products = Array.isArray(filteredProducts) ? filteredProducts : [];
  const fullCatalog = Array.isArray(allProducts) ? allProducts : [];
  const profile = fullCatalog[0]?.seller?.seller_profile || products[0]?.seller?.seller_profile;
  const shopName = profile?.shop_name ?? user?.display_name ?? user?.username ?? params.username;
  const shopDescription = profile?.shop_description ?? user?.bio ?? "Creator storefront, resources, updates, and support information.";
  const avatarURL = user?.avatar_url || profile?.shop_banner_url || "";
  const sellerUsername = user?.username ?? params.username;
  const categoryMap = new Map((categories || []).map((category) => [category.id, category]));
  const sellerCategories = uniqueCategories(fullCatalog, categoryMap);

  const stats = fullCatalog.reduce(
    (acc, product) => {
      acc.resources += 1;
      acc.purchases += product.total_sales || 0;
      acc.downloads += product.total_downloads || 0;
      acc.reviews += product.review_count || 0;
      acc.ratingTotal += (product.average_rating || 0) * (product.review_count || 0);
      return acc;
    },
    { resources: 0, purchases: 0, downloads: 0, reviews: 0, ratingTotal: 0 },
  );
  const averageRating = stats.reviews > 0 ? stats.ratingTotal / stats.reviews : 0;

  return (
    <main className="space-y-5">
      <section className="overflow-hidden rounded-panel border border-border bg-surface shadow-[0_24px_90px_rgba(0,0,0,0.28)]">
        {profile?.shop_banner_url ? <img src={profile.shop_banner_url} alt="" className="h-44 w-full object-cover" /> : null}
        <div className="p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-elevated text-2xl font-semibold text-textPrimary">
              {avatarURL ? <img src={avatarURL} alt="" className="h-full w-full object-cover" /> : shopName.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-3xl font-semibold text-textPrimary">{shopName}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-textSecondary">{shopDescription}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-textSecondary">
                <span className="rounded-full border border-border bg-elevated px-3 py-1">Owner @{sellerUsername}</span>
                <span className="rounded-full border border-success/30 bg-success/10 px-3 py-1 text-success">Support available</span>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <StoreStat icon={Package} label="Resources" value={stats.resources} />
            <StoreStat icon={ShoppingBag} label="Purchases" value={stats.purchases} />
            <StoreStat icon={Download} label="Downloads" value={stats.downloads} />
            <StoreStat icon={Star} label="Average rating" value={averageRating ? averageRating.toFixed(2) : "0.00"} />
            <StoreStat icon={Star} label="Reviews" value={stats.reviews} />
          </div>
        </div>

        <div className="flex border-t border-border px-4 sm:px-6">
          <Link href={`/sellers/${params.username}`} className="border-b-2 border-primary px-4 py-3 text-sm font-medium text-textPrimary">
            Resources
          </Link>
          <span className="px-4 py-3 text-sm text-textSecondary">Bundles</span>
        </div>
      </section>

      <section className="rounded-panel border border-border bg-surface p-4 shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
        <form className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between" action={`/sellers/${params.username}`} method="get">
          <div className="flex flex-wrap gap-2">
            <FilterButton href={storeHref(params.username, { search, sort: selectedSort, category: "all" })} active={selectedCategory === "all"}>
              All categories
            </FilterButton>
            {sellerCategories.map((category) => (
              <FilterButton key={category.id} href={storeHref(params.username, { search, sort: selectedSort, category: category.id })} active={selectedCategory === category.id || selectedCategory === category.slug}>
                {category.name}
              </FilterButton>
            ))}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="relative min-w-0 sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-textSecondary" />
              <input name="search" defaultValue={search} placeholder={`Search resources by ${shopName}`} className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm text-textPrimary outline-none focus:border-primary" />
            </label>
            <input type="hidden" name="category" value={selectedCategory} />
            <select name="sort" defaultValue={selectedSort} className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-textPrimary">
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button type="submit" className="h-10 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground">
              Search
            </button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-panel border border-border bg-surface shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
        {products.length === 0 ? (
          <div className="p-8 text-center text-sm text-textSecondary">No resources match this filter.</div>
        ) : (
          <div className="divide-y divide-border">
            {products.map((product) => (
              <ResourceRow key={product.id} product={product} category={product.category_id ? categoryMap.get(product.category_id) : undefined} shopName={shopName} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function StoreStat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-elevated p-3">
      <Icon className="mb-2 size-4 text-primary" />
      <p className="text-lg font-semibold text-textPrimary">{value}</p>
      <p className="text-xs text-textSecondary">{label}</p>
    </div>
  );
}

function FilterButton({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <Link href={href} className={`rounded-xl border px-3 py-2 text-sm transition ${active ? "border-primary/40 bg-primary/15 text-textPrimary" : "border-border bg-elevated text-textSecondary hover:text-textPrimary"}`}>
      {children}
    </Link>
  );
}

function ResourceRow({ product, category, shopName }: { product: Product; category?: Category; shopName: string }) {
  const meta = product.total_sales > 0 ? `${product.total_sales} purchases` : `${product.total_downloads || 0} downloads`;
  return (
    <article className="grid gap-4 p-4 transition hover:bg-elevated lg:grid-cols-[180px_1fr_210px] lg:items-center">
      <Link href={`/products/${product.slug}`} className="relative aspect-[2/1] overflow-hidden rounded-xl border border-border bg-background">
        <img src={product.banner_url || product.thumbnail_url || "/placeholder-product.png"} alt="" className="h-full w-full object-cover" />
        <span className="absolute bottom-2 left-2 rounded-md bg-black/70 px-2 py-1 text-xs text-white">
          <PriceDisplay value={product.price} />
        </span>
      </Link>
      <div className="min-w-0">
        <Link href={`/products/${product.slug}`} className="text-lg font-semibold text-textPrimary hover:text-primary">
          {product.title}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-textSecondary">
          <span>{shopName}</span>
          {category ? <span>{category.name}</span> : null}
        </div>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-textSecondary">{product.short_description}</p>
      </div>
      <div className="space-y-2 lg:text-right">
        <div className="inline-flex lg:justify-end">
          <RatingStars value={product.average_rating} />
        </div>
        <p className="text-sm text-textSecondary">{product.review_count > 0 ? `${product.review_count} ratings` : "Not yet rated"}</p>
        <p className="text-sm text-textSecondary">{meta}</p>
      </div>
    </article>
  );
}

function uniqueCategories(products: Product[], categoryMap: Map<string, Category>) {
  const seen = new Set<string>();
  const result: Category[] = [];
  for (const product of products) {
    if (!product.category_id || seen.has(product.category_id)) continue;
    const category = categoryMap.get(product.category_id);
    if (!category) continue;
    seen.add(product.category_id);
    result.push(category);
  }
  return result.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.name.localeCompare(b.name));
}

function storeHref(username: string, params: { search?: string; category?: string; sort?: string }) {
  const query = new URLSearchParams();
  if (params.category && params.category !== "all") query.set("category", params.category);
  if (params.search) query.set("search", params.search);
  if (params.sort && params.sort !== "newest") query.set("sort", params.sort);
  const suffix = query.toString();
  return `/sellers/${username}${suffix ? `?${suffix}` : ""}`;
}
