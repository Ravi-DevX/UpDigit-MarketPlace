"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Coins,
  FileBarChart2,
  Flag,
  History,
  LayoutDashboard,
  LifeBuoy,
  Package,
  Palette,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Tag,
  Users,
} from "lucide-react";
import { AuthGate } from "@/components/auth/AuthGate";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { cn } from "@/lib/utils";

const adminItems = [
  { href: "/admin", icon: LayoutDashboard, label: "Overview" },
  { href: "/admin/users", icon: Users, label: "Users" },
  { href: "/admin/products", icon: Package, label: "Products" },
  { href: "/admin/orders", icon: ShoppingCart, label: "Orders" },
  { href: "/admin/sellers", icon: ShieldCheck, label: "Sellers" },
  { href: "/admin/payouts", icon: Coins, label: "Payouts" },
  { href: "/admin/categories", icon: FileBarChart2, label: "Categories" },
  { href: "/admin/tickets", icon: LifeBuoy, label: "Tickets" },
  { href: "/admin/reports", icon: Flag, label: "Reports" },
  { href: "/admin/coupons", icon: Tag, label: "Coupons" },
  { href: "/admin/analytics", icon: FileBarChart2, label: "Analytics" },
  { href: "/admin/audit-logs", icon: History, label: "Audit Logs" },
  { href: "/admin/theme", icon: Palette, label: "Theme Studio" },
  { href: "/admin/settings", icon: Settings, label: "Settings" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background text-textPrimary">
      <Navbar />
      <AuthGate allowedRoles={["admin"]} redirectTo="/" label="Checking admin permissions...">
        <div className="site-frame flex flex-col gap-5 py-8 lg:flex-row">
          <aside className="glass-panel h-max rounded-panel p-3 lg:sticky lg:top-28 lg:w-[var(--sidebar-width)]">
            <Link href="/" className="mb-5 flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
              <span className="flex size-10 items-center justify-center rounded-2xl bg-primary text-sm font-bold text-primary-foreground">
                U
              </span>
              <span>
                <span className="block text-sm font-semibold text-textPrimary">UpDigit Admin</span>
                <span className="block text-xs text-textSecondary">Marketplace operations</span>
              </span>
            </Link>

            <div className="mb-3 px-2 text-xs uppercase tracking-[0.16em] text-textSecondary">Control center</div>
            <nav className="grid gap-1 sm:grid-cols-2 lg:grid-cols-1">
              {adminItems.map(({ href, icon: Icon, label }) => {
                const active = pathname === href || (href !== "/admin" && pathname.startsWith(href));
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
                <p className="text-xs uppercase tracking-[0.16em] text-primary">Admin area</p>
                <h1 className="mt-1 text-2xl font-semibold text-textPrimary">Operations Console</h1>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-textSecondary">
                <span className="rounded-full border border-success/30 bg-success/10 px-3 py-1 text-success">Live APIs</span>
                <span className="rounded-full border border-border bg-surface px-3 py-1">Moderation</span>
                <span className="rounded-full border border-border bg-surface px-3 py-1">Analytics</span>
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
