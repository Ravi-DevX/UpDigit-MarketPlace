import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ProductDetailContent, getProduct, normalizeProductTab, type ProductResourceTab } from "../ProductDetailContent";

const validTabs = new Set<ProductResourceTab>(["dependencies", "updates", "reviews", "history"]);

export async function generateMetadata({ params }: { params: { slug: string; tab: string } }): Promise<Metadata> {
  const tab = normalizeProductTab(params.tab);
  if (!validTabs.has(tab)) {
    notFound();
  }
  try {
    const product = await getProduct(params.slug);
    return {
      title: `${product.title} ${tab[0].toUpperCase()}${tab.slice(1)} | UpDigit Marketplace`,
      description: product.short_description ?? "",
      alternates: { canonical: `/products/${product.slug}/${tab}` },
      openGraph: {
        images: [product.banner_url || product.thumbnail_url || "/placeholder-product.png"],
      },
    };
  } catch {
    return { title: `${tab[0].toUpperCase()}${tab.slice(1)} | UpDigit Marketplace` };
  }
}

export default async function ProductTabPage({ params }: { params: { slug: string; tab: string } }) {
  const tab = normalizeProductTab(params.tab);
  if (!validTabs.has(tab)) {
    notFound();
  }
  const product = await getProduct(params.slug).catch(() => notFound());
  if (product.slug !== params.slug) {
    redirect(`/products/${product.slug}/${tab}`);
  }
  return <ProductDetailContent slug={params.slug} activeTab={tab} initialProduct={product} />;
}
