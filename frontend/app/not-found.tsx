import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";

export default function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-3xl flex-col justify-center px-4 py-16">
      <p className="text-xs uppercase tracking-[0.16em] text-primary">Page not found</p>
      <h1 className="mt-3 text-3xl font-semibold text-textPrimary">This marketplace page does not exist.</h1>
      <p className="mt-3 text-sm leading-6 text-textSecondary">
        The product, category, or account may have moved. Continue browsing from the catalog.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/products"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-[var(--accent-hover)]"
        >
          <Search className="size-4" />
          Browse products
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-textSecondary transition hover:border-primary/40 hover:text-textPrimary"
        >
          <ArrowLeft className="size-4" />
          Home
        </Link>
      </div>
    </main>
  );
}
