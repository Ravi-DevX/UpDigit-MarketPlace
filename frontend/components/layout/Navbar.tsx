"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Boxes,
  ChevronRight,
  Crown,
  Flame,
  Gift,
  Heart,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  PackagePlus,
  PanelsTopLeft,
  Rocket,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Store,
  Tags,
  TrendingUp,
  UserRound,
  Wallet,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { fetchCategories, fetchNotifications, fetchPublicSettings, requestDgenLogin, requestLogout } from "@/lib/api";
import { demoCategories } from "@/lib/demo";
import type { Category, PublicSiteSettings } from "@/types/marketplace";
import { SearchBar } from "@/components/common/SearchBar";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  NavGridCard,
  type NavItemType,
} from "@/components/ui/navigation-menu";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/common/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const productLinks: NavItemType[] = [
  {
    title: "Featured Drops",
    href: "/products",
    description: "Curated plugins, templates, scripts, and creator tooling.",
    icon: Crown,
  },
  {
    title: "Trending Now",
    href: "/products?sort=downloaded",
    description: "Products getting real traction across the marketplace.",
    icon: Flame,
  },
  {
    title: "New Arrivals",
    href: "/products?sort=newest",
    description: "Fresh listings from active builders and studios.",
    icon: Sparkles,
  },
  {
    title: "Free Products",
    href: "/products?price=free",
    description: "Start fast with free assets and utility packs.",
    icon: Gift,
  },
];

const sellerLinks: NavItemType[] = [
  {
    title: "Seller Studio",
    href: "/seller",
    description: "Manage your shop, listings, fulfillment, and profile.",
    icon: Store,
  },
  {
    title: "Create Product",
    href: "/seller/products/new",
    description: "Publish a new digital product with versions and media.",
    icon: PackagePlus,
  },
  {
    title: "Earnings",
    href: "/seller/earnings",
    description: "Track revenue, balances, and payout readiness.",
    icon: Wallet,
  },
];

function categoryToNavItem(category: Category): NavItemType {
  return {
    title: category.name,
    href: `/products?category=${category.slug}`,
    description: category.description ?? "Browse marketplace products in this category.",
    icon: Tags,
  };
}

function navPill(active: boolean) {
  return cn(
    "inline-flex h-9 items-center rounded-full px-3 text-sm font-medium text-textSecondary transition hover:bg-elevated hover:text-textPrimary",
    active && "bg-white/10 text-textPrimary",
  );
}

const defaultSiteSettings: PublicSiteSettings = {
  site_name: "UpDigit",
  site_tagline: "Marketplace",
  site_description: "Marketplace for digital builders",
  site_logo_url: "",
  support_email: "support@updigit.net",
  seo_default_title: "UpDigit Marketplace",
  seo_default_description: "Dark marketplace for digital products, plugins, scripts and game assets.",
  announcement_text: "",
};

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const isAuth = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const hasCheckedSession = useAuthStore((state) => state.hasCheckedSession);
  const [categories, setCategories] = useState<Category[]>(demoCategories);
  const [siteSettings, setSiteSettings] = useState<PublicSiteSettings>(defaultSiteSettings);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [accountOpen, setAccountOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetchCategories()
      .then((items) => {
        if (mounted && items.length > 0) {
          setCategories(items.slice(0, 6));
        }
      })
      .catch(() => {
        if (mounted) {
          setCategories(demoCategories);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hasCheckedSession || !isAuth || !user) {
      setUnreadNotifications(0);
      return;
    }
    let mounted = true;
    const load = () => {
      void fetchNotifications()
        .then((items) => {
          if (mounted) setUnreadNotifications(items.filter((item) => !item.is_read).length);
        })
        .catch(() => undefined);
    };
    load();
    const timer = window.setInterval(load, 60_000);
    window.addEventListener("updigit:notifications-changed", load);
    return () => {
      mounted = false;
      window.clearInterval(timer);
      window.removeEventListener("updigit:notifications-changed", load);
    };
  }, [hasCheckedSession, isAuth, user?.id]);

  useEffect(() => {
    let mounted = true;
    fetchPublicSettings()
      .then((settings) => {
        if (mounted) {
          setSiteSettings({ ...defaultSiteSettings, ...settings });
        }
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  const categoryLinks = useMemo(() => categories.slice(0, 6).map(categoryToNavItem), [categories]);
  const isAdmin = user?.role === "admin";
  const isSeller = user?.role === "seller" || isAdmin;
  const accountLinks: NavItemType[] = [
    { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { title: "Your Profile", href: user?.username ? `/members/${user.username}` : "/dashboard", icon: UserRound },
    { title: "Purchases", href: "/dashboard/purchases", icon: Boxes },
    { title: "Wishlist", href: "/dashboard/wishlist", icon: Heart },
    { title: "Notifications", href: "/dashboard/notifications", icon: Bell },
    { title: "Settings", href: "/dashboard/settings", icon: Settings2 },
  ];
  if (isSeller) {
    accountLinks.splice(3, 0, { title: "Seller Studio", href: "/seller", icon: Store });
  }
  if (isAdmin) {
    accountLinks.splice(4, 0, { title: "Admin Console", href: "/admin", icon: ShieldCheck });
  }

  const signOut = async () => {
    try {
      await requestLogout();
    } finally {
      router.push("/login");
    }
  };

  const mobileLinks = [
    { href: "/products", label: "Products", icon: PanelsTopLeft },
    { href: "/products", label: "Categories", icon: Tags },
    { href: "/support", label: "Tickets", icon: LifeBuoy },
    { href: "/seller", label: "Seller", icon: Store },
    { href: "/products?sort=downloaded", label: "Trending", icon: TrendingUp },
  ];

  return (
    <header className="sticky top-3 z-50 w-full px-3">
      <nav className="site-frame glass-panel min-h-[var(--navigation-height)] rounded-panel px-3 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/" className="group flex items-center gap-3 rounded-full pr-2">
            <span className="flex size-10 items-center justify-center rounded-2xl border border-border bg-white/10 text-base font-bold text-textPrimary shadow-lg transition group-hover:border-primary/45">
              {siteSettings.site_logo_url ? (
                <img src={siteSettings.site_logo_url} alt="" className="size-7 object-contain" />
              ) : (
                siteSettings.site_name.slice(0, 1).toUpperCase()
              )}
            </span>
            <span className="hidden leading-tight sm:block">
              <span className="block text-sm font-semibold text-textPrimary">{siteSettings.site_name}</span>
              <span className="block text-[11px] text-textSecondary">{siteSettings.site_tagline}</span>
            </span>
          </Link>

          <NavigationMenu viewport={false} className="hidden flex-none lg:flex">
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuTrigger>Products</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <div className="w-[620px] p-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      {productLinks.map((link) => (
                        <NavGridCard key={link.title} link={link} />
                      ))}
                    </div>
                  </div>
                </NavigationMenuContent>
              </NavigationMenuItem>

              <NavigationMenuItem>
                <NavigationMenuTrigger>Categories</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <div className="w-[560px] p-3">
                    <div className="mb-3 flex items-center justify-between px-1">
                      <p className="text-xs uppercase tracking-[0.18em] text-textSecondary">Browse by build type</p>
                      <Link href="/products" className="inline-flex items-center gap-1 text-xs text-primary hover:text-textPrimary">
                        All categories <ChevronRight className="size-3" />
                      </Link>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {categoryLinks.map((link) => (
                        <NavigationMenuLink key={link.title} asChild>
                          <Link href={link.href} className="group flex-row items-center gap-3 rounded-xl border border-border bg-elevated p-3">
                            {link.icon ? <link.icon className="size-4 shrink-0 text-primary" /> : null}
                            <span className="min-w-0">
                              <span className="block text-sm font-medium text-textPrimary">{link.title}</span>
                              <span className="line-clamp-1 text-xs text-textSecondary">{link.description}</span>
                            </span>
                          </Link>
                        </NavigationMenuLink>
                      ))}
                    </div>
                  </div>
                </NavigationMenuContent>
              </NavigationMenuItem>

              <NavigationMenuItem>
                <NavigationMenuTrigger>Seller</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <div className="w-[520px] p-3">
                    <div className="mb-3 rounded-2xl border border-primary/30 bg-primary/10 p-4">
                      <p className="text-sm font-medium text-textPrimary">Creator operating system</p>
                      <p className="mt-1 text-xs leading-5 text-textSecondary">
                        Upload products, review orders, watch earnings, and keep your marketplace operations tight.
                      </p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {sellerLinks.map((link) => (
                        <NavigationMenuLink key={link.title} asChild>
                          <Link href={link.href} className="rounded-xl border border-border bg-elevated p-3">
                            {link.icon ? <link.icon className="mb-3 size-5 text-primary" /> : null}
                            <span className="block text-sm font-medium text-textPrimary">{link.title}</span>
                            <span className="mt-1 block text-xs leading-5 text-textSecondary">{link.description}</span>
                          </Link>
                        </NavigationMenuLink>
                      ))}
                    </div>
                  </div>
                </NavigationMenuContent>
              </NavigationMenuItem>

              <NavigationMenuItem>
                <NavigationMenuLink asChild>
                  <Link href="/support" className={navPill(pathname.startsWith("/support") || pathname.startsWith("/dashboard/tickets"))}>
                    Tickets
                  </Link>
                </NavigationMenuLink>
              </NavigationMenuItem>

            </NavigationMenuList>
          </NavigationMenu>

          <div className="order-3 w-full min-w-[220px] flex-1 sm:order-none sm:min-w-[280px]">
            <SearchBar placeholder="Search products, tags, seller..." />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden items-center gap-1 md:flex lg:hidden">
              <Link href="/products" className={navPill(pathname.startsWith("/products"))}>
                Products
              </Link>
              <Link href="/products" className={navPill(pathname.startsWith("/products"))}>
                Categories
              </Link>
              <Link href="/seller" className={navPill(pathname.startsWith("/seller"))}>
                Seller
              </Link>
              <Link href="/support" className={navPill(pathname.startsWith("/support"))}>
                Tickets
              </Link>
            </div>

            {isAuth && user ? (
              <Button asChild variant="outline" size="icon" className="relative rounded-full">
                <Link href="/dashboard/notifications" aria-label={unreadNotifications > 0 ? `${unreadNotifications} unread notifications` : "Notifications"}>
                  <Bell className="size-4" />
                  {unreadNotifications > 0 ? <Badge className="absolute -right-2 -top-2 min-w-5 justify-center px-1">{unreadNotifications > 99 ? "99+" : unreadNotifications}</Badge> : null}
                </Link>
              </Button>
            ) : null}

            <Link
              href="/cart"
              className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-surface text-textSecondary transition hover:border-primary/40 hover:bg-elevated hover:text-textPrimary"
              aria-label="Cart"
            >
              <ShoppingCart className="size-4" />
            </Link>

            {!hasCheckedSession ? (
              <span className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-surface px-3 text-sm text-textSecondary">
                <span className="size-2 animate-pulse rounded-full bg-primary" />
                <span className="hidden sm:inline">Session</span>
              </span>
            ) : isAuth && user ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setAccountOpen((open) => !open)}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-surface py-0 pl-1.5 pr-3 text-sm text-textSecondary transition hover:border-primary/40 hover:bg-elevated hover:text-textPrimary"
                  aria-expanded={accountOpen}
                  aria-haspopup="menu"
                >
                      <UserAvatar username={user.username} displayName={user.display_name} avatarURL={user.avatar_url} className="size-7 text-xs" />
                      <span className="hidden max-w-28 truncate sm:inline">{user.username || "Account"}</span>
                </button>
                {accountOpen ? (
                  <div className="absolute right-0 top-full z-50 mt-3 w-[300px] overflow-hidden rounded-2xl border border-border bg-[var(--bg-panel)] p-3 shadow-[0_24px_90px_rgba(0,0,0,0.42)] backdrop-blur-2xl" role="menu">
                        <div className="mb-2 rounded-2xl border border-border bg-surface p-4">
                          <div className="flex items-center gap-3">
                            <UserAvatar username={user.username} displayName={user.display_name} avatarURL={user.avatar_url} className="size-11 text-sm" />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-textPrimary">{user.display_name || user.username}</p>
                              <p className="truncate text-xs text-textSecondary">{user.email || user.role}</p>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-1">
                          {accountLinks.map((item) => (
                              <Link key={item.title} href={item.href} onClick={() => setAccountOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-textSecondary transition hover:bg-elevated hover:text-textPrimary" role="menuitem">
                                {item.icon ? <item.icon className="size-4 text-primary" /> : null}
                                {item.title}
                              </Link>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              setAccountOpen(false);
                              void signOut();
                            }}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-textSecondary transition hover:bg-elevated hover:text-textPrimary"
                            role="menuitem"
                          >
                            <LogOut className="size-4 text-danger" />
                            Sign out
                          </button>
                        </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => requestDgenLogin(pathname)}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground shadow-[0_14px_40px_rgba(99,102,241,0.28)] transition hover:bg-[var(--accent-hover)]"
              >
                <Rocket className="size-4" />
                <span className="hidden sm:inline">Sign in</span>
              </button>
            )}
          </div>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 md:hidden">
          {mobileLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={label}
              href={href}
              className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 text-xs text-textSecondary"
            >
              <Icon className="size-3.5" />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
