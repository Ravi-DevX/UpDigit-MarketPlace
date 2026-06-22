"use client";

import { useEffect, useState } from "react";
import { BookOpen, Github, Instagram, LifeBuoy, Mail, ShieldCheck, Store, Twitter, Youtube } from "lucide-react";
import Link from "next/link";
import { fetchPublicSettings } from "@/lib/api";
import type { PublicSiteSettings } from "@/types/marketplace";

const footerColumns = [
  {
    title: "Marketplace",
    links: [
      { text: "All Products", href: "/products" },
      { text: "Categories", href: "/categories" },
      { text: "Free Products", href: "/products?price_max=0" },
      { text: "Trending", href: "/products?sort=downloaded" },
    ],
  },
  {
    title: "Creators",
    links: [
      { text: "Seller Portal", href: "/seller" },
      { text: "New Product", href: "/seller/products/new" },
      { text: "Earnings", href: "/seller/earnings" },
      { text: "Webhooks", href: "/seller/webhooks" },
    ],
  },
  {
    title: "Account",
    links: [
      { text: "Dashboard", href: "/dashboard" },
      { text: "Purchases", href: "/dashboard/purchases" },
      { text: "Wishlist", href: "/dashboard/wishlist" },
      { text: "Settings", href: "/dashboard/settings" },
    ],
  },
];

const legalLinks = [
  { text: "Terms", href: "/terms" },
  { text: "Privacy", href: "/privacy" },
  { text: "Support", href: "/search" },
];

const socialLinks = [
  { icon: Instagram, label: "Instagram", href: "#" },
  { icon: Twitter, label: "Twitter", href: "#" },
  { icon: Github, label: "GitHub", href: "#" },
  { icon: Youtube, label: "YouTube", href: "#" },
];

const defaultSiteSettings: PublicSiteSettings = {
  site_name: "UpDigit",
  site_tagline: "Marketplace for digital builders",
  site_description: "Curated digital products for builders who need clean assets, fast delivery, creator tools, and dependable marketplace operations.",
  site_logo_url: "",
  support_email: "support@updigit.net",
  seo_default_title: "UpDigit Marketplace",
  seo_default_description: "Dark marketplace for digital products, plugins, scripts and game assets.",
  announcement_text: "",
};

export default function Footer4Col() {
  const [settings, setSettings] = useState<PublicSiteSettings>(defaultSiteSettings);

  useEffect(() => {
    let mounted = true;
    fetchPublicSettings()
      .then((payload) => {
        if (mounted) {
          setSettings({ ...defaultSiteSettings, ...payload });
        }
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <footer className="relative mt-20 w-full overflow-hidden border-t border-border bg-background">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
      <div className="site-frame relative pb-8 pt-14">
        <div className="mb-12 rounded-panel border border-border bg-surface p-6 shadow-[0_24px_90px_rgba(0,0,0,0.34)] backdrop-blur-xl md:p-8">
          <div className="grid gap-6 md:grid-cols-[1.15fr_0.85fr] md:items-center">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.12em] text-primary">
                <ShieldCheck className="size-3.5" />
                Secure digital delivery
              </div>
              <h3 className="max-w-2xl text-2xl font-semibold tracking-tight text-textPrimary md:text-3xl">
                Ship plugins, scripts, templates, and creator tools through one marketplace.
              </h3>
              <p className="mt-3 max-w-xl text-sm leading-6 text-textSecondary">
                {settings.site_name} connects buyers with verified digital products, instant access, creator storefronts, and marketplace operations built for scale.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-1 lg:grid-cols-3">
              {[
                { icon: Store, label: "Creator shops", href: "/seller" },
                { icon: BookOpen, label: "Docs", href: "/search" },
                { icon: LifeBuoy, label: "Support", href: "/search" },
              ].map(({ icon: Icon, label, href }) => (
                <Link
                  key={label}
                  href={href}
                  className="group flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-textSecondary transition hover:border-primary/40 hover:bg-elevated hover:text-textPrimary"
                >
                  <Icon className="size-4 text-primary" />
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
          <div className="col-span-2">
            <Link href="/" className="mb-5 flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-2xl border border-border bg-white/10 text-base font-bold text-textPrimary shadow-lg">
                {settings.site_logo_url ? <img src={settings.site_logo_url} alt="" className="size-7 object-contain" /> : settings.site_name.slice(0, 1).toUpperCase()}
              </span>
              <span>
                <span className="block text-lg font-semibold text-textPrimary">{settings.site_name}</span>
                <span className="text-xs text-textSecondary">{settings.site_tagline}</span>
              </span>
            </Link>
            <p className="max-w-sm text-sm leading-6 text-textSecondary">
              {settings.site_description}
            </p>
            <div className="mt-6 flex gap-3">
              {socialLinks.map(({ icon: Icon, label, href }) => (
                <Link
                  key={label}
                  href={href}
                  aria-label={label}
                  className="flex size-10 items-center justify-center rounded-full border border-border bg-surface text-textSecondary transition hover:border-primary/40 hover:bg-primary/10 hover:text-primary-foreground"
                >
                  <Icon className="size-4" />
                </Link>
              ))}
            </div>
          </div>

          {footerColumns.map((column) => (
            <div key={column.title}>
              <h4 className="mb-4 text-sm font-semibold text-textPrimary">{column.title}</h4>
              <ul className="space-y-3">
                {column.links.map((link) => (
                  <li key={link.text}>
                    <Link href={link.href} className="text-sm text-textSecondary transition hover:text-textPrimary">
                      {link.text}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-border pt-6 text-sm text-textSecondary md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} {settings.site_name} Marketplace. All rights reserved.</p>
          <div className="flex flex-wrap gap-5">
            {legalLinks.map((link) => (
              <Link key={link.text} href={link.href} className="hover:text-textPrimary">
                {link.text}
              </Link>
            ))}
          </div>
          <a href={`mailto:${settings.support_email}`} className="inline-flex items-center gap-2 hover:text-textPrimary">
            <Mail className="size-4" />
            {settings.support_email}
          </a>
        </div>
      </div>
    </footer>
  );
}
