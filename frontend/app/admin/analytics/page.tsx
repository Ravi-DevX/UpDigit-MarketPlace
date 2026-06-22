import Link from "next/link";
import { ArrowRight, BarChart3, Boxes, CircleDollarSign, Users } from "lucide-react";
import { PageHeader } from "@/app/admin/_components/AdminUI";

const analyticsLinks = [
  {
    href: "/admin/analytics/overview",
    title: "Overview",
    description: "Platform totals, daily revenue, pending products, buyers, and sellers.",
    icon: BarChart3,
  },
  {
    href: "/admin/analytics/revenue",
    title: "Revenue",
    description: "Completed order revenue grouped by day, week, or month.",
    icon: CircleDollarSign,
  },
  {
    href: "/admin/analytics/products",
    title: "Products",
    description: "Top products ranked by completed revenue and order volume.",
    icon: Boxes,
  },
  {
    href: "/admin/analytics/users",
    title: "Users",
    description: "User totals, today growth, buyer activity, and active sellers.",
    icon: Users,
  },
];

export default function AdminAnalyticsIndex() {
  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Analytics"
        title="Marketplace intelligence"
        description="Navigate operational reporting backed by the admin analytics API."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {analyticsLinks.map(({ href, title, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-2xl border border-border bg-surface p-5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-elevated"
          >
            <div className="mb-8 flex items-center justify-between">
              <Icon className="size-5 text-primary" />
              <ArrowRight className="size-4 text-textSecondary transition group-hover:translate-x-1 group-hover:text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-textPrimary">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-textSecondary">{description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
