import { Product } from "@/types/marketplace";
import { ProductCard } from "@/components/product/ProductCard";
import { toArray } from "@/lib/payload";

export function ProductGrid({ products }: { products: unknown }) {
  const items = toArray<Product>(products, ["data", "products", "items", "payload", "results", "rows"])
    .filter((product): product is Product => Boolean(product && typeof product === "object"));

  if (!Array.isArray(items)) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-center text-textSecondary backdrop-blur-xl">
        Product feed is temporarily unavailable.
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-center text-textSecondary backdrop-blur-xl">
        No products found. Try different filters or check back later.
      </div>
    );
  }

  return (
    <div className="product-showcase-grid">
      {items.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
