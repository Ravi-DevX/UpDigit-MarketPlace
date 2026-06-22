"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Coins,
  Home,
  Link2,
  Package,
  PackagePlus,
  Settings,
  ShoppingCart,
  Store,
  Ticket,
} from "lucide-react";
import { AuthGate } from "@/components/auth/AuthGate";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { cn } from "@/lib/utils";

const sellerItems = [
  { href: "/seller", icon: Home, label: "Overview" },
  { href: "/seller/products", icon: Package, label: "Products" },
  { href: "/seller/products/new", icon: PackagePlus, label: "Add Product" },
  { href: "/seller/orders", icon: ShoppingCart, label: "Orders" },
  { href: "/seller/earnings", icon: Coins, label: "Earnings" },
  { href: "/seller/coupons", icon: Ticket, label: "Coupons" },
  { href: "/seller/webhooks", icon: Link2, label: "Webhooks" },
  { href: "/seller/settings", icon: Settings, label: "Store Settings" },
];

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background text-textPrimary">
      <Navbar />
      <AuthGate allowedRoles={["seller", "admin"]} redirectTo="/" label="Checking seller permissions...">
        <div className="site-frame flex flex-col gap-5 py-8 lg:flex-row">
          <aside className="glass-panel h-max rounded-panel p-3 lg:sticky lg:top-28 lg:w-[var(--sidebar-width)]">
            <Link href="/" className="mb-5 flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
              <span className="flex size-10 items-center justify-center rounded-2xl bg-primary text-sm font-bold text-primary-foreground">
                U
              </span>
              <span>
                <span className="block text-sm font-semibold text-textPrimary">Seller Studio</span>
                <span className="block text-xs text-textSecondary">UpDigit creator tools</span>
              </span>
            </Link>

            <Link
              href="/seller/products/new"
              className="mb-4 flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-[0_18px_50px_rgba(99,102,241,0.25)] transition hover:bg-[var(--accent-hover)]"
            >
              <PackagePlus className="size-4" />
              Publish product
            </Link>

            <div className="mb-3 px-2 text-xs uppercase tracking-[0.16em] text-textSecondary">Creator operations</div>
            <nav className="grid gap-1 sm:grid-cols-2 lg:grid-cols-1">
              {sellerItems.map(({ href, icon: Icon, label }) => {
                const active = pathname === href || (href !== "/seller" && pathname.startsWith(href));
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-textSecondary transition hover:bg-elevated hover:text-textPrimary",
                      active && "border border-primary/30 bg-primary/10 text-primary-foreground shadow-[0_14px_40px_rgba(99,102,241,0.16)]",
                    )}
                  >
                    <Icon className={cn("size-4", active ? "text-primary" : "text-textSecondary")} />
                    {label}
                  </Link>
                );
              })}
            </nav>
          </aside>

          <main className="min-w-0 flex-1">
            <div className="mb-5 flex flex-col gap-3 rounded-panel border border-border bg-surface p-5 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-primary">Seller area</p>
                <h1 className="mt-1 text-2xl font-semibold text-textPrimary">Creator Console</h1>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-textSecondary">
                <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-success">
                  <Store className="size-3" />
                  Storefront
                </span>
                <span className="rounded-full border border-border bg-surface px-3 py-1">Listings</span>
                <span className="rounded-full border border-border bg-surface px-3 py-1">Files</span>
              </div>
            </div>
            <section className="rounded-panel border border-border bg-surface p-4 shadow-[0_24px_90px_rgba(0,0,0,0.28)] backdrop-blur-xl md:p-6">
              {children}
            </section>
          </main>
        </div>
      </AuthGate>
      <Footer />
    </div>
  );
}
