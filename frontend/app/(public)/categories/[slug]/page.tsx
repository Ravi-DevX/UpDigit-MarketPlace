import { Metadata } from "next";
import { redirect } from "next/navigation";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const title = params.slug.split("-").join(" ");
  return {
    title: `${title} | UpDigit Marketplace`,
    description: `Browse ${title} products on UpDigit Marketplace.`,
  };
}

export default function CategoryPage({ params }: { params: { slug: string } }) {
  redirect(`/products?category=${encodeURIComponent(params.slug)}`);
}
