import { Metadata } from "next";
import Link from "next/link";
import { SearchBar } from "@/components/common/SearchBar";
import { ProductGrid } from "@/components/product/ProductGrid";
import { fetchProducts, fetchSearchSuggestions } from "@/lib/api";
import { demoProducts } from "@/lib/demo";

export const metadata: Metadata = {
  title: "Search | UpDigit Marketplace",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string; category?: string };
}) {
  const query = typeof searchParams.q === "string" ? searchParams.q : "";
  const category = searchParams.category;
  const products = await fetchProducts({ search: query || undefined, category, limit: 24 }).catch(() => demoProducts);
  const safeProducts = Array.isArray(products) ? products : [];
  const suggestions = query ? await fetchSearchSuggestions(query).catch(() => []) : [];
  const safeSuggestions = Array.isArray(suggestions) ? suggestions : [];

  return (
    <main className="space-y-6">
      <div className="rounded-panel border border-border bg-surface p-5 backdrop-blur-xl">
        <h1 className="text-2xl font-semibold text-textPrimary">Search marketplace</h1>
        <p className="mt-2 text-sm text-textSecondary">
          Results for <span className="text-textPrimary">&quot;{query || "all products"}&quot;</span>
        </p>
        <div className="mt-5">
          <SearchBar placeholder="Search products, tags, seller..." defaultValue={query} />
        </div>
      </div>
      {query ? (
        <div className="space-y-2">
          <div className="text-sm text-textSecondary">Suggestions</div>
          <div className="flex flex-wrap gap-2">
            {safeSuggestions.map((item) => (
              <Link
                key={item}
                href={`/search?q=${encodeURIComponent(item)}`}
                className="rounded border border-border px-2 py-1 text-xs text-textSecondary"
              >
                {item}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
      <ProductGrid products={safeProducts} />
    </main>
  );
}
