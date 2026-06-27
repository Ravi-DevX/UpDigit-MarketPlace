"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { Bell, Heart, LifeBuoy, MessageSquare, Package, Settings2, ShoppingCart, User } from "lucide-react";
import { AuthGate } from "@/components/auth/AuthGate";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/common/UserAvatar";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);

  const navItem = (href: string, icon: React.ReactNode, label: string) => (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm text-textSecondary transition hover:bg-elevated hover:text-textPrimary",
        pathname === href && "border border-primary/30 bg-primary/10 text-primary-foreground",
      )}
    >
      {icon}
      {label}
    </Link>
  );

  return (
    <div className="min-h-screen bg-background text-[var(--text-primary)]">
      <Navbar />
      <AuthGate loginRedirect label="Checking account session...">
        <div className="site-frame flex flex-col gap-5 py-8 lg:flex-row">
          <aside className="glass-panel h-max rounded-panel p-3 lg:sticky lg:top-28 lg:w-[var(--sidebar-width)]">
            <div className="mb-5 flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
              <UserAvatar username={user?.username} displayName={user?.display_name} avatarURL={user?.avatar_url} className="size-10 text-sm" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-textPrimary">{user?.display_name || user?.username || "Your account"}</span>
                <span className="block text-xs text-textSecondary">Marketplace account</span>
              </span>
            </div>
            <p className="mb-3 px-2 text-xs uppercase tracking-[0.16em] text-textSecondary">Your account</p>
            <nav className="grid gap-1 sm:grid-cols-2 lg:grid-cols-1">
              {navItem("/dashboard", <User className="h-4 w-4" />, "Dashboard")}
              {user?.username ? navItem(`/members/${user.username}`, <User className="h-4 w-4" />, "Public profile") : null}
              {navItem("/dashboard/purchases", <Package className="h-4 w-4" />, "Purchases")}
              {navItem("/dashboard/conversations", <MessageSquare className="h-4 w-4" />, "Conversations")}
              {navItem("/dashboard/tickets", <LifeBuoy className="h-4 w-4" />, "Tickets")}
              {navItem("/dashboard/wishlist", <Heart className="h-4 w-4" />, "Wishlist")}
              {navItem("/dashboard/notifications", <Bell className="h-4 w-4" />, "Notifications")}
              {navItem("/dashboard/settings", <Settings2 className="h-4 w-4" />, "Settings")}
              {navItem("/cart", <ShoppingCart className="h-4 w-4" />, "Cart")}
            </nav>
          </aside>
          <main className="min-w-0 flex-1 rounded-panel border border-border bg-surface p-4 shadow-[0_24px_90px_rgba(0,0,0,0.28)] backdrop-blur-xl md:p-6">
            {children}
          </main>
        </div>
      </AuthGate>
      <Footer />
    </div>
  );
}
