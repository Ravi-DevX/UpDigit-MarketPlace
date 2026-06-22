import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ProductDetailContent, getProduct } from "./ProductDetailContent";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  try {
    const product = await getProduct(params.slug);
    return {
      title: `${product.title} | UpDigit Marketplace`,
      description: product.short_description ?? "",
      alternates: { canonical: `/products/${product.slug}` },
      openGraph: {
        images: [product.banner_url || product.thumbnail_url || "/placeholder-product.png"],
      },
    };
  } catch {
    return { title: "Resource | UpDigit Marketplace" };
  }
}

export default async function ProductDetailPage({ params }: { params: { slug: string } }) {
  const product = await getProduct(params.slug).catch(() => notFound());
  if (product.slug !== params.slug) {
    redirect(`/products/${product.slug}`);
  }
  return <ProductDetailContent slug={params.slug} activeTab="overview" initialProduct={product} />;
}
