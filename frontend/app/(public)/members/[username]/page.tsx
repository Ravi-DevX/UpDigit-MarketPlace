import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, ExternalLink, MessageSquare, Package, ShieldCheck, Star, UserRound, type LucideIcon } from "lucide-react";
import { ProductGrid } from "@/components/product/ProductGrid";
import { fetchSellerProducts, fetchUserByUsername } from "@/lib/api";
import type { Product, User } from "@/types/marketplace";

type ProfileStat = {
  label: string;
  value: string | number;
  icon: LucideIcon;
};

function date(value?: string) {
  if (!value) {
    return "Unknown";
  }
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function statProducts(products: Product[]) {
  const sales = products.reduce((sum, product) => sum + (product.total_sales || 0), 0);
  const downloads = products.reduce((sum, product) => sum + (product.total_downloads || 0), 0);
  const reviews = products.reduce((sum, product) => sum + (product.review_count || 0), 0);
  const ratingPool = products.filter((product) => product.average_rating > 0);
  const rating = ratingPool.length
    ? ratingPool.reduce((sum, product) => sum + product.average_rating, 0) / ratingPool.length
    : 0;
  return { sales, downloads, reviews, rating };
}

function initials(user: User) {
  return (user.display_name || user.username || "U").slice(0, 2).toUpperCase();
}

export default async function MemberProfilePage({ params }: { params: { username: string } }) {
  const user = await fetchUserByUsername(params.username).catch(() => null);
  if (!user) {
    notFound();
  }
  const products = await fetchSellerProducts(params.username).catch(() => [] as Product[]);
  const stats = statProducts(products);
  const profileStats: ProfileStat[] = [
    { label: "Resources", value: products.length, icon: Package },
    { label: "Sales", value: stats.sales, icon: ShieldCheck },
    { label: "Downloads", value: stats.downloads, icon: Package },
    { label: "Reviews", value: stats.reviews, icon: MessageSquare },
    { label: "Rating", value: stats.rating ? stats.rating.toFixed(1) : "0.0", icon: Star },
    { label: "Feedback", value: 0, icon: UserRound },
  ];

  return (
    <main className="space-y-6">
      <section className="overflow-hidden rounded-panel border border-border bg-surface shadow-[0_24px_90px_rgba(0,0,0,0.28)] backdrop-blur-xl">
        <div className="h-32 bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.32),transparent_32%),linear-gradient(120deg,rgba(20,184,166,0.28),rgba(99,102,241,0.18),rgba(244,63,94,0.14))]">
          {user.profile_banner_url ? (
            <img src={user.profile_banner_url} alt="" className="h-full w-full object-cover" />
          ) : null}
        </div>
        <div className="p-5 md:p-6">
          <div className="-mt-16 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex size-28 items-center justify-center overflow-hidden rounded-[1.75rem] border border-border bg-elevated text-2xl font-bold text-textPrimary shadow-2xl">
                {user.avatar_url ? <img src={user.avatar_url} alt="" className="size-full object-cover" /> : initials(user)}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-3xl font-semibold text-textPrimary">{user.display_name || user.username}</h1>
                  {user.is_verified ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-xs text-success">
                      <ShieldCheck className="size-3" />
                      Verified
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-textSecondary">@{user.username} · {user.role}</p>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-textSecondary">
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="size-3.5" />
                    Joined {date(user.created_at)}
                  </span>
                  <span>Last seen recently</span>
                </div>
              </div>
            </div>
            {user.website_url ? (
              <Link href={user.website_url} className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm text-textSecondary transition hover:border-primary/40 hover:text-textPrimary">
                Website
                <ExternalLink className="size-4" />
              </Link>
            ) : null}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {profileStats.map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-2xl border border-border bg-surface p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-textSecondary">{label}</p>
                  <Icon className="size-4 text-primary" />
                </div>
                <p className="mt-2 text-2xl font-semibold text-textPrimary">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <aside className="space-y-4">
          <section className="rounded-2xl border border-border bg-surface p-5 backdrop-blur-xl">
            <h2 className="text-base font-semibold text-textPrimary">About</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-textSecondary">
              {user.bio || "This member has not added an about section yet."}
            </p>
          </section>
          <section className="rounded-2xl border border-border bg-surface p-5 backdrop-blur-xl">
            <h2 className="text-base font-semibold text-textPrimary">Identities</h2>
            <div className="mt-3 space-y-2 text-sm text-textSecondary">
              <p>Discord: {user.discord_tag || "Not shared"}</p>
              <p>Email: {user.email ? "Shared with marketplace" : "Not shared"}</p>
            </div>
          </section>
        </aside>

        <section className="space-y-4">
          <div className="flex flex-wrap gap-2 text-sm">
            {["Profile posts", "Latest activity", "Resources", "About"].map((item) => (
              <span key={item} className="rounded-full border border-border bg-surface px-3 py-1.5 text-textSecondary">
                {item}
              </span>
            ))}
          </div>
          <section className="rounded-2xl border border-border bg-surface p-5 backdrop-blur-xl">
            <h2 className="text-base font-semibold text-textPrimary">Resources</h2>
            <div className="mt-4">
              <ProductGrid products={products} />
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
