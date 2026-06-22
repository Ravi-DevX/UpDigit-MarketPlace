import Link from "next/link";

type Filters = {
  category?: string;
  sort?: string;
  price?: string;
  search?: string;
  tags?: string;
};

function productsHref(filters: Filters, updates: Partial<Filters>) {
  const query = new URLSearchParams();
  const next = { ...filters, ...updates };

  for (const [key, value] of Object.entries(next)) {
    if (value) {
      query.set(key, value);
    }
  }

  const serialized = query.toString();
  return `/products${serialized ? `?${serialized}` : ""}`;
}

function filterLink(href: string, label: string, active: boolean) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-9 items-center justify-center rounded-lg border px-3 py-1.5 text-sm transition ${
        active
          ? "border-primary/70 bg-primary/15 text-primary-foreground"
          : "border-border bg-elevated text-textSecondary hover:border-primary/40 hover:text-textPrimary"
      }`}
    >
      {label}
    </Link>
  );
}

export function ProductFilters({ filters }: { filters: Filters }) {
  const sort = filters.sort ?? "newest";
  const price = filters.price ?? "";
  const baseFilters = {
    category: filters.category,
    search: filters.search,
    tags: filters.tags,
    sort,
    price,
  };

  return (
    <div className="space-y-5 rounded-xl border border-border bg-surface p-4">
      <div>
        <h3 className="text-sm font-semibold text-textPrimary">Price</h3>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {filterLink(productsHref(baseFilters, { price: undefined }), "All", !price)}
          {filterLink(productsHref(baseFilters, { price: "free" }), "Free", price === "free")}
          {filterLink(productsHref(baseFilters, { price: "premium" }), "Paid", price === "premium")}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-textPrimary">Sort</h3>
        <div className="mt-3 grid grid-cols-1 gap-2">
          {[
            ["newest", "Newest"],
            ["downloaded", "Most downloaded"],
            ["rated", "Highest rated"],
            ["price_low", "Price low to high"],
            ["price_high", "Price high to low"],
          ].map(([key, label]) =>
            filterLink(productsHref(baseFilters, { sort: key }), label, sort === key),
          )}
        </div>
      </div>
    </div>
  );
}
