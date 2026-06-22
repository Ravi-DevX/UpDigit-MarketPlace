import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Crown,
  Flame,
  Gift,
  PackageCheck,
  Rocket,
  ShieldCheck,
  Sparkles,
  Store,
  Tags,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { ProductGrid } from "@/components/product/ProductGrid";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import {
  fetchBumpedProducts,
  fetchCategories,
  fetchFeaturedProducts,
  fetchFreeProducts,
  fetchNewProducts,
  fetchProducts,
  fetchTrendingProducts,
} from "@/lib/api";
import { Product, Category } from "@/types/marketplace";
import { demoCategories, demoProducts, demoStats } from "@/lib/demo";
import { toArray } from "@/lib/payload";

async function safeFetch<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

function compact(value: number) {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function flattenCategories(categories: Category[]): Category[] {
  return categories.flatMap((category) => [category, ...(category.children ? flattenCategories(category.children) : [])]);
}

function uniqueProducts(items: Product[]) {
  const map = new Map<string, Product>();
  items.forEach((item) => {
    map.set(item.id || item.slug, item);
  });
  return [...map.values()];
}

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [
    featuredResponse,
    trendingResponse,
    newProductsResponse,
    freeProductsResponse,
    bumpedResponse,
    allProductsResponse,
    categoriesResponse,
  ] = await Promise.all([
    safeFetch(() => fetchFeaturedProducts(), demoProducts),
    safeFetch(() => fetchTrendingProducts(), demoProducts),
    safeFetch(() => fetchNewProducts(), demoProducts),
    safeFetch(() => fetchFreeProducts(), demoProducts),
    safeFetch(() => fetchBumpedProducts(), demoProducts),
    safeFetch(() => fetchProducts({ limit: 48, sort: "newest" }), demoProducts),
    safeFetch(() => fetchCategories(), demoCategories),
  ]);

  const featuredProducts = toArray<Product>(featuredResponse, ["products", "data", "items", "payload", "results"]);
  const trendingProducts = toArray<Product>(trendingResponse, ["products", "data", "items", "payload", "results"]);
  const newProducts = toArray<Product>(newProductsResponse, ["products", "data", "items", "payload", "results"]);
  const freeProducts = toArray<Product>(freeProductsResponse, ["products", "data", "items", "payload", "results"]);
  const bumpedProducts = toArray<Product>(bumpedResponse, ["products", "data", "items", "payload", "results"]);
  const allProducts = toArray<Product>(allProductsResponse, ["products", "data", "items", "payload", "results"]);
  const categories = Array.isArray(categoriesResponse) && categoriesResponse.length > 0 ? categoriesResponse : demoCategories;

  const catalog = uniqueProducts([
    ...featuredProducts,
    ...trendingProducts,
    ...newProducts,
    ...freeProducts,
    ...bumpedProducts,
    ...allProducts,
  ]);
  const heroProduct = featuredProducts[0] ?? trendingProducts[0] ?? catalog[0] ?? demoProducts[0];
  const heroProducts = uniqueProducts([heroProduct, ...trendingProducts, ...newProducts, ...demoProducts]).slice(0, 3);
  const totalDownloads = catalog.reduce((sum, item) => sum + (item.total_downloads || 0), 0);
  const totalSales = catalog.reduce((sum, item) => sum + (item.total_sales || 0), 0);
  const creatorCount = new Set(
    catalog
      .map((item) => item.seller?.id || item.seller?.username || item.seller_id)
      .filter(Boolean),
  ).size;
  const flatCategories = flattenCategories(categories);

  const stats = [
    {
      label: "Listed products",
      value: compact(catalog.length || demoStats.total_products),
      detail: "Live catalog sample",
      icon: Boxes,
    },
    {
      label: "Creator shops",
      value: compact(creatorCount || demoStats.total_sellers),
      detail: "Sellers and studios",
      icon: Store,
    },
    {
      label: "Tracked downloads",
      value: compact(totalDownloads || demoStats.total_downloads),
      detail: "Across visible products",
      icon: PackageCheck,
    },
    {
      label: "Completed sales",
      value: compact(totalSales),
      detail: "Marketplace activity",
      icon: Wallet,
    },
  ];
  const heroBoxIcons = [Boxes, Tags, Store, Sparkles];
  const heroCategoryBoxes = flatCategories.slice(0, 4).map((category, index) => ({
    title: category.name,
    detail: category.description || "Browse products in this category",
    href: `/products?category=${category.slug}`,
    icon: heroBoxIcons[index] ?? Tags,
  }));
  const heroBoxes = [
    ...heroCategoryBoxes,
    { title: "All products", detail: "Open the full marketplace catalog", href: "/products", icon: Boxes },
    { title: "Trending", detail: "See what buyers are opening now", href: "/products?sort=downloaded", icon: TrendingUp },
    { title: "Free products", detail: "Start with no-cost downloads", href: "/products?price=free", icon: Gift },
    { title: "Seller tools", detail: "Publish and manage your listings", href: "/seller", icon: Store },
  ].slice(0, 4);

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      <Navbar />
      <main className="site-frame space-y-16 py-8">
      <section className="relative overflow-hidden rounded-panel border border-border bg-[linear-gradient(135deg,#08090c_0%,#10131a_42%,#0d1115_100%)] shadow-[0_30px_120px_rgba(0,0,0,0.38)]">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/80 to-transparent" />
        <div className="grid gap-10 p-5 sm:p-8 lg:grid-cols-[1.05fr_0.95fr] lg:p-10 xl:p-12">
          <div className="flex flex-col justify-center">
            <p className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-primary">
              <Sparkles className="size-3.5" />
              Digital marketplace for builders
            </p>
            <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-tight tracking-tight text-textPrimary sm:text-6xl">
              Find serious tools, scripts, plugins, and templates without marketplace noise.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-textSecondary">
              UpDigit gives creators a clean storefront and buyers instant access to high-signal digital products for apps, games, automation, and developer workflows.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/products"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-[0_18px_50px_rgba(99,102,241,0.3)] transition hover:bg-[var(--accent-hover)]"
              >
                Browse products <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/seller"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-5 py-3 text-sm font-medium text-textPrimary backdrop-blur transition hover:border-primary/40 hover:bg-elevated"
              >
                Start selling <Rocket className="size-4" />
              </Link>
            </div>
            <div className="mt-9 grid max-w-4xl grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {heroBoxes.map(({ title, detail, href, icon: Icon }) => (
                <Link
                  key={title}
                  href={href}
                  className="group min-h-[98px] rounded-lg border border-border bg-surface p-4 transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-elevated"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <Icon className="size-4 text-primary" />
                    <ArrowRight className="size-4 text-textSecondary transition group-hover:translate-x-1 group-hover:text-primary" />
                  </div>
                  <p className="text-sm font-semibold text-textPrimary">{title}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-textSecondary">{detail}</p>
                </Link>
              ))}
            </div>
          </div>

          <div className="relative min-h-[420px] lg:min-h-[560px]">
            <div className="absolute inset-0 rounded-panel border border-border bg-[linear-gradient(160deg,rgba(255,255,255,0.08),rgba(255,255,255,0.025))] shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-2xl" />
            <div className="relative grid h-full gap-4 p-4 sm:p-5">
              <div className="overflow-hidden rounded-[1.5rem] border border-border bg-black/30">
                <img
                  src={heroProduct.banner_url || heroProduct.thumbnail_url || "/placeholder-product.png"}
                  alt={heroProduct.title}
                  className="h-56 w-full object-cover sm:h-72"
                />
                <div className="p-5">
                  <div className="mb-3 flex flex-wrap gap-2">
                    {heroProduct.is_featured ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2.5 py-1 text-xs text-warning">
                        <Crown className="size-3" />
                        Featured
                      </span>
                    ) : null}
                    {heroProduct.is_exclusive ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-xs text-success">
                        <ShieldCheck className="size-3" />
                        Exclusive
                      </span>
                    ) : null}
                  </div>
                  <Link href={`/products/${heroProduct.slug}`} className="text-xl font-semibold text-textPrimary hover:text-textPrimary">
                    {heroProduct.title}
                  </Link>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-textSecondary">{heroProduct.short_description}</p>
                  <div className="mt-5 flex items-center justify-between text-sm">
                    <span className="text-textSecondary">by {heroProduct.seller?.username ?? "creator"}</span>
                    <span className="font-semibold text-textPrimary">{heroProduct.price > 0 ? `$${heroProduct.price.toFixed(2)}` : "Free"}</span>
                  </div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {heroProducts.map((product) => (
                  <Link
                    key={product.id}
                    href={`/products/${product.slug}`}
                    className="group overflow-hidden rounded-2xl border border-border bg-surface transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-elevated"
                  >
                    <img
                      src={product.thumbnail_url || "/placeholder-product.png"}
                      alt={product.title}
                      className="h-24 w-full object-cover"
                    />
                    <div className="p-3">
                      <p className="line-clamp-1 text-sm font-medium text-textPrimary">{product.title}</p>
                      <p className="mt-1 text-xs text-textSecondary">{compact(product.total_downloads || 0)} downloads</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {stats.map(({ label, value, detail, icon: Icon }) => (
          <article
            key={label}
            className="rounded-2xl border border-border bg-surface p-5 shadow-[0_18px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl"
          >
            <div className="mb-6 flex items-center justify-between">
              <Icon className="size-5 text-primary" />
              <span className="rounded-full border border-border px-2 py-1 text-[11px] uppercase tracking-[0.12em] text-textSecondary">
                Live
              </span>
            </div>
            <p className="text-3xl font-semibold text-textPrimary">{value}</p>
            <p className="mt-1 text-sm text-textSecondary">{label}</p>
            <p className="mt-4 text-xs text-textSecondary">{detail}</p>
          </article>
        ))}
      </section>

      <section>
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-primary">Build lanes</p>
            <h2 className="mt-2 text-2xl font-semibold text-textPrimary">Browse by category</h2>
          </div>
          <Link href="/categories" className="inline-flex items-center gap-2 text-sm text-primary hover:text-textPrimary">
            View all categories <ArrowRight className="size-4" />
          </Link>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {flatCategories.slice(0, 6).map((category, index) => (
            <Link
              key={category.id}
              href={`/categories/${category.slug}`}
              className="group rounded-2xl border border-border bg-surface p-5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-elevated"
            >
              <div className="mb-6 flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-2xl bg-elevated text-sm font-semibold text-textPrimary">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <ArrowRight className="size-4 text-textSecondary transition group-hover:translate-x-1 group-hover:text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-textPrimary">{category.name}</h3>
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-textSecondary">{category.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-5 flex items-center gap-3">
          <Crown className="size-5 text-warning" />
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-warning">Curated</p>
            <h2 className="text-2xl font-semibold text-textPrimary">Featured products</h2>
          </div>
        </div>
        <ProductGrid products={featuredProducts.slice(0, 6)} />
      </section>

      <section className="grid gap-8 lg:grid-cols-2">
        <div>
          <div className="mb-5 flex items-center gap-3">
            <Flame className="size-5 text-danger" />
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-danger">Momentum</p>
              <h2 className="text-2xl font-semibold text-textPrimary">Trending now</h2>
            </div>
          </div>
          <ProductGrid products={trendingProducts.slice(0, 4)} />
        </div>
        <div>
          <div className="mb-5 flex items-center gap-3">
            <TrendingUp className="size-5 text-primary" />
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-primary">Fresh</p>
              <h2 className="text-2xl font-semibold text-textPrimary">New arrivals</h2>
            </div>
          </div>
          <ProductGrid products={newProducts.slice(0, 4)} />
        </div>
      </section>

      <section className="grid gap-4 rounded-panel border border-border bg-surface p-5 backdrop-blur-xl md:grid-cols-[1fr_2fr] md:p-7">
        <div className="flex flex-col justify-between">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs uppercase tracking-[0.14em] text-success">
              <Gift className="size-3.5" />
              Starter shelf
            </p>
            <h2 className="mt-4 text-2xl font-semibold text-textPrimary">Free products and bumped listings</h2>
            <p className="mt-3 text-sm leading-6 text-textSecondary">
              Keep a quick eye on zero-cost tools, rediscovered products, and listings creators are actively pushing.
            </p>
          </div>
          <Link href="/products" className="mt-6 inline-flex items-center gap-2 text-sm text-primary hover:text-textPrimary">
            Explore catalog <ArrowRight className="size-4" />
          </Link>
        </div>
        <ProductGrid products={uniqueProducts([...freeProducts, ...bumpedProducts]).slice(0, 6)} />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          {
            icon: ShieldCheck,
            title: "Protected access",
            text: "Marketplace sessions, refresh tokens, and CSRF protection are already wired into the app shell.",
          },
          {
            icon: Users,
            title: "Creator-first profiles",
            text: "Seller shops, product versions, media, reviews, and orders are structured for real marketplace workflows.",
          },
          {
            icon: Rocket,
            title: "Ready for launch polish",
            text: "The interface now has a stronger premium surface while keeping the current backend contracts intact.",
          },
        ].map(({ icon: Icon, title, text }) => (
          <article key={title} className="rounded-2xl border border-border bg-surface p-5">
            <Icon className="mb-5 size-5 text-primary" />
            <h3 className="text-base font-semibold text-textPrimary">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-textSecondary">{text}</p>
          </article>
        ))}
      </section>
      </main>
      <Footer />
    </div>
  );
}
