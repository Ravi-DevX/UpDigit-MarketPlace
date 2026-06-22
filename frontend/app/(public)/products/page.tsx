import Link from "next/link";
import { Boxes, ChevronRight, Search, SlidersHorizontal, Tags } from "lucide-react";
import { ProductGrid } from "@/components/product/ProductGrid";
import { ProductFilters } from "@/components/product/ProductFilters";
import { fetchCategories, fetchProducts } from "@/lib/api";
import { Category, Product } from "@/types/marketplace";
import { demoCategories, demoProducts } from "@/lib/demo";

interface SearchParams {
  category?: string;
  sort?: string;
  search?: string;
  q?: string;
  tags?: string;
  price?: string;
  price_min?: string;
  price_max?: string;
  page?: string;
}

type CategoryOption = {
  category: Category;
  depth: number;
};

function normalizePrice(searchParams: SearchParams) {
  if (searchParams.price) {
    return searchParams.price;
  }
  if (searchParams.price_max === "0") {
    return "free";
  }
  if (searchParams.price_min) {
    return "premium";
  }
  return undefined;
}

async function safeProducts(searchParams: SearchParams): Promise<Product[]> {
  try {
    const price = normalizePrice(searchParams);
    const page = Number(typeof searchParams.page === "string" ? searchParams.page : undefined);

    return await fetchProducts({
      category: typeof searchParams.category === "string" ? searchParams.category : undefined,
      sort: typeof searchParams.sort === "string" ? searchParams.sort : "newest",
      search:
        typeof searchParams.search === "string"
          ? searchParams.search
          : typeof searchParams.q === "string"
            ? searchParams.q
            : undefined,
      tags: typeof searchParams.tags === "string" ? searchParams.tags : undefined,
      price_min: price === "premium" ? "0.01" : searchParams.price_min,
      price_max: price === "free" ? "0" : searchParams.price_max,
      page: Number.isNaN(page) ? 1 : page,
    });
  } catch {
    return demoProducts;
  }
}

async function safeCategories(): Promise<Category[]> {
  try {
    const categories = await fetchCategories();
    return Array.isArray(categories) && categories.length > 0 ? categories : demoCategories;
  } catch {
    return demoCategories;
  }
}

function flattenCategories(categories: Category[], depth = 0): CategoryOption[] {
  return categories.flatMap((category) => [
    { category, depth },
    ...flattenCategories(Array.isArray(category.children) ? category.children : [], depth + 1),
  ]);
}

function categoryHasActive(category: Category, activeSlug?: string): boolean {
  if (!activeSlug) {
    return false;
  }
  if (category.slug === activeSlug) {
    return true;
  }
  return (category.children ?? []).some((child) => categoryHasActive(child, activeSlug));
}

function productsHref(params: SearchParams, updates: Partial<SearchParams> = {}) {
  const next = { ...params, ...updates };
  const query = new URLSearchParams();

  for (const key of ["category", "sort", "search", "tags", "price", "page"] as const) {
    const value = next[key];
    if (value) {
      query.set(key, value);
    }
  }

  const serialized = query.toString();
  return `/products${serialized ? `?${serialized}` : ""}`;
}

function categoryName(slug?: string) {
  if (!slug) {
    return "All products";
  }
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function CategoryGroup({ category, searchParams }: { category: Category; searchParams: SearchParams }) {
  const children = category.children ?? [];
  const active = searchParams.category === category.slug;
  const containsActive = categoryHasActive(category, searchParams.category);

  if (children.length === 0) {
    return (
      <Link
        href={productsHref(searchParams, { category: category.slug, page: undefined })}
        className={`flex min-h-10 items-center justify-between rounded-lg px-3 text-sm transition ${
          active ? "bg-primary/15 text-primary-foreground" : "text-textSecondary hover:bg-elevated hover:text-textPrimary"
        }`}
      >
        <span className="truncate">{category.name}</span>
        <ChevronRight className="size-4 shrink-0" />
      </Link>
    );
  }

  return (
    <details open={containsActive} className="group rounded-lg">
      <summary
        className={`flex min-h-10 cursor-pointer list-none items-center justify-between rounded-lg px-3 text-sm transition marker:hidden ${
          containsActive ? "bg-elevated text-textPrimary" : "text-textSecondary hover:bg-elevated hover:text-textPrimary"
        }`}
      >
        <span className="truncate">{category.name}</span>
        <ChevronRight className="size-4 shrink-0 transition group-open:rotate-90" />
      </summary>
      <div className="mt-1 grid gap-1 border-l border-border pl-3">
        <Link
          href={productsHref(searchParams, { category: category.slug, page: undefined })}
          className={`flex min-h-9 items-center rounded-lg px-3 text-sm transition ${
            active ? "bg-primary/15 text-primary-foreground" : "text-textSecondary hover:bg-elevated hover:text-textPrimary"
          }`}
        >
          All {category.name}
        </Link>
        {children.map((child) => (
          <Link
            key={child.id}
            href={productsHref(searchParams, { category: child.slug, page: undefined })}
            className={`flex min-h-9 items-center rounded-lg px-3 text-sm transition ${
              searchParams.category === child.slug
                ? "bg-primary/15 text-primary-foreground"
                : "text-textSecondary hover:bg-elevated hover:text-textPrimary"
            }`}
          >
            <span className="truncate">{child.name}</span>
          </Link>
        ))}
      </div>
    </details>
  );
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const [products, categories] = await Promise.all([safeProducts(searchParams), safeCategories()]);
  const safeProductsList = Array.isArray(products) ? products : [];
  const categoryOptions = flattenCategories(categories);
  const selectedCategory = categoryOptions.find((entry) => entry.category.slug === searchParams.category)?.category;
  const price = normalizePrice(searchParams);
  const page = Number(searchParams.page ?? 1);
  const safePage = Number.isNaN(page) || page < 1 ? 1 : page;
  const hasNext = safeProductsList.length >= 12;
  const activeSearch = searchParams.search ?? searchParams.q ?? "";
  const activeCategoryLabel = selectedCategory?.name ?? categoryName(searchParams.category);

  return (
    <main className="space-y-6">
      <nav className="flex flex-wrap items-center gap-2 text-sm text-textSecondary">
        <Link href="/products" className="hover:text-textPrimary">
          Resources
        </Link>
        <ChevronRight className="size-4" />
        <span className="text-textPrimary">{activeCategoryLabel}</span>
      </nav>

      <section className="rounded-xl border border-border bg-surface p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-primary">
              <Boxes className="size-4" />
              Marketplace catalog
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-textPrimary">Browse products and categories</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-textSecondary">
              Pick a category, filter price and quality signals, then open the product page from the same flow.
            </p>
          </div>
          <form action="/products" className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[420px] sm:flex-row">
            {searchParams.category ? <input type="hidden" name="category" value={searchParams.category} /> : null}
            {searchParams.sort ? <input type="hidden" name="sort" value={searchParams.sort} /> : null}
            {price ? <input type="hidden" name="price" value={price} /> : null}
            <label className="relative flex-1">
              <span className="sr-only">Search products</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-textSecondary" />
              <input
                name="search"
                defaultValue={activeSearch}
                placeholder="Search products, tags, seller..."
                className="h-11 w-full rounded-lg border border-border bg-surface pl-10 pr-3 text-sm text-textPrimary outline-none transition placeholder:text-textSecondary focus:border-primary/60"
              />
            </label>
            <button className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-[var(--accent-hover)]">
              Search
            </button>
          </form>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[290px_minmax(0,1fr)]">
        <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
          <section className="rounded-xl border border-border bg-surface p-4">
            <div className="mb-3 flex items-center gap-2">
              <Tags className="size-4 text-primary" />
              <h2 className="text-sm font-semibold text-textPrimary">Categories</h2>
            </div>
            <div className="space-y-1">
              <Link
                href={productsHref(searchParams, { category: undefined, page: undefined })}
                className={`flex min-h-10 items-center justify-between rounded-lg px-3 text-sm transition ${
                  !searchParams.category ? "bg-primary/15 text-primary-foreground" : "text-textSecondary hover:bg-elevated hover:text-textPrimary"
                }`}
              >
                All products
                <ChevronRight className="size-4" />
              </Link>
              {categories.map((category) => (
                <CategoryGroup key={category.id} category={category} searchParams={searchParams} />
              ))}
            </div>
          </section>

          <ProductFilters
            filters={{
              category: searchParams.category,
              sort: searchParams.sort,
              price,
              search: activeSearch,
              tags: searchParams.tags,
            }}
          />
        </aside>

        <section className="min-w-0 space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-elevated p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-textPrimary">{safeProductsList.length} products shown</p>
              <p className="mt-1 text-xs text-textSecondary">
                {activeCategoryLabel}
                {price ? ` / ${price === "free" ? "Free" : "Paid"}` : ""}
                {activeSearch ? ` / "${activeSearch}"` : ""}
              </p>
            </div>
            <Link
              href={productsHref(searchParams, { category: undefined, search: undefined, tags: undefined, price: undefined, page: undefined })}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-textSecondary transition hover:border-primary/40 hover:text-textPrimary"
            >
              <SlidersHorizontal className="size-4" />
              Reset browse
            </Link>
          </div>

          <ProductGrid products={safeProductsList} />

          <div className="flex items-center justify-between rounded-xl border border-border bg-elevated px-4 py-3 text-sm">
            {safePage > 1 ? (
              <Link
                href={productsHref(searchParams, { page: String(safePage - 1) })}
                className="rounded-lg border border-border px-3 py-1.5 text-textSecondary transition hover:border-primary/40 hover:text-textPrimary"
              >
                Previous
              </Link>
            ) : (
              <span className="rounded-lg border border-border px-3 py-1.5 text-textSecondary/50">Previous</span>
            )}
            <span className="text-textSecondary">Page {safePage}</span>
            {hasNext ? (
              <Link
                href={productsHref(searchParams, { page: String(safePage + 1) })}
                className="rounded-lg border border-border px-3 py-1.5 text-textSecondary transition hover:border-primary/40 hover:text-textPrimary"
              >
                Next
              </Link>
            ) : (
              <span className="rounded-lg border border-border px-3 py-1.5 text-textSecondary/50">Next</span>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
