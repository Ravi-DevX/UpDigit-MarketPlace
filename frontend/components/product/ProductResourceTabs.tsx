"use client";

import { useEffect, useState } from "react";
import type { MouseEvent, ReactNode } from "react";

export type ResourceTabId = "overview" | "dependencies" | "updates" | "reviews" | "history";

type ProductResourceTabsProps = {
  slug: string;
  initialTab: ResourceTabId;
  updateCount: number;
  reviewCount: number;
  overview: ReactNode;
  dependencies: ReactNode;
  updates: ReactNode;
  reviews: ReactNode;
  history: ReactNode;
};

const tabs: Array<{ id: ResourceTabId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "dependencies", label: "Dependencies" },
  { id: "updates", label: "Updates" },
  { id: "reviews", label: "Reviews" },
  { id: "history", label: "History" },
];

function href(slug: string, tab: ResourceTabId) {
  return tab === "overview" ? `/products/${slug}` : `/products/${slug}/${tab}`;
}

function tabFromPath(pathname: string): ResourceTabId {
  const segment = pathname.split("/").filter(Boolean).pop();
  return segment === "dependencies" || segment === "updates" || segment === "reviews" || segment === "history" ? segment : "overview";
}

export function ProductResourceTabs({ slug, initialTab, updateCount, reviewCount, overview, dependencies, updates, reviews, history }: ProductResourceTabsProps) {
  const [active, setActive] = useState<ResourceTabId>(initialTab);
  const panes: Record<ResourceTabId, ReactNode> = { overview, dependencies, updates, reviews, history };

  useEffect(() => setActive(initialTab), [initialTab]);
  useEffect(() => {
    const onPopState = () => setActive(tabFromPath(window.location.pathname));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const select = (event: MouseEvent<HTMLAnchorElement>, tab: ResourceTabId) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (tab === active) return;
    window.history.pushState({}, "", href(slug, tab));
    setActive(tab);
    window.scrollTo({ top: Math.max(0, document.querySelector("[data-resource-tabs]")?.getBoundingClientRect().top ?? 0) + window.scrollY - 90, behavior: "smooth" });
  };

  return (
    <div data-resource-tabs className="min-w-0 space-y-4">
      <nav className="overflow-x-auto border-b border-border" aria-label="Resource sections">
        <div className="flex min-w-max gap-1">
          {tabs.map((tab) => {
            const label = tab.id === "updates" ? `Updates (${updateCount})` : tab.id === "reviews" ? `Reviews (${reviewCount})` : tab.label;
            return (
              <a key={tab.id} href={href(slug, tab.id)} onClick={(event) => select(event, tab.id)} aria-current={active === tab.id ? "page" : undefined} className={`rounded-t-lg px-4 py-3 text-sm transition ${active === tab.id ? "bg-elevated text-textPrimary" : "text-textSecondary hover:bg-surface hover:text-textPrimary"}`}>
                {label}
              </a>
            );
          })}
        </div>
      </nav>
      <div key={active}>{panes[active]}</div>
    </div>
  );
}
