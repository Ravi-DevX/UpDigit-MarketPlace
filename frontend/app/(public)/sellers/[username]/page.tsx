import { Metadata } from "next";
import { ProductGrid } from "@/components/product/ProductGrid";
import { demoProducts } from "@/lib/demo";
import { fetchSellerProducts, fetchUserByUsername } from "@/lib/api";

export async function generateMetadata({
  params,
}: {
  params: { username: string };
}): Promise<Metadata> {
  const user = await fetchUserByUsername(params.username).catch(() => null);
  const shopName = user?.display_name ?? params.username;
  return {
    title: `${shopName} | UpDigit Seller`,
    description: user?.bio ?? "Seller storefront",
  };
}

export default async function SellerPage({ params }: { params: { username: string } }) {
  const products = await fetchSellerProducts(params.username).catch(() => demoProducts);
  const safeProducts = Array.isArray(products) ? products : [];
  return (
    <main className="space-y-6">
      <section className="rounded border border-border bg-surface p-6">
        <h1 className="text-3xl font-semibold">Seller: {params.username}</h1>
        <p className="mt-2 text-textSecondary">Catalog, stats, and profile for this shop.</p>
        <div className="mt-4 grid gap-2 text-sm text-textSecondary sm:grid-cols-3">
          <p>Products: {safeProducts.length}</p>
          <p>Members since: 2024</p>
          <p>Support: available</p>
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-xl font-semibold">Shop Products</h2>
        <ProductGrid products={safeProducts} />
      </section>
    </main>
  );
}
