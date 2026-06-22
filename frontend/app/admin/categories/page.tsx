"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Plus, Search, Trash2 } from "lucide-react";
import { createAdminCategory, deleteAdminCategory, fetchAdminCategories } from "@/lib/api";
import type { Category } from "@/types/marketplace";
import {
  actionButtonClass,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  StatusBadge,
} from "@/app/admin/_components/AdminUI";

function flatten(categories: Category[], depth = 0): Array<Category & { depth: number }> {
  return categories.flatMap((category) => [{ ...category, depth }, ...flatten(category.children || [], depth + 1)]);
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setState("loading");
    try {
      setCategories(await fetchAdminCategories());
      setState("ready");
    } catch {
      setState("error");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const flat = useMemo(() => flatten(categories), [categories]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return flat;
    }
    return flat.filter((category) => [category.name, category.slug, category.description || ""].some((value) => value.toLowerCase().includes(needle)));
  }, [flat, query]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    setCreating(true);
    try {
      await createAdminCategory({
        name,
        slug: String(form.get("slug") || "").trim() || slugify(name),
        parent_id: String(form.get("parent_id") || "").trim() || null,
        description: String(form.get("description") || "").trim() || null,
        icon_url: String(form.get("icon_url") || "").trim() || null,
        sort_order: Number(form.get("sort_order") || 0),
        is_active: form.get("is_active") === "on",
        minimum_price: Number(form.get("minimum_price") || 0),
        publishing_config: {},
      });
      event.currentTarget.reset();
      await load();
    } finally {
      setCreating(false);
    }
  };

  const remove = async (id: string) => {
    setBusyId(id);
    try {
      await deleteAdminCategory(id);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Taxonomy"
        title="Categories"
        description="Manage the marketplace category tree used by product publishing, navigation, and discovery."
      />

      <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-border bg-surface p-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1.2fr_0.55fr_0.65fr_auto] xl:items-end">
        <label className="grid gap-1 text-xs text-textSecondary">
          Name
          <input name="name" required placeholder="Plugins" className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-textPrimary outline-none" />
        </label>
        <label className="grid gap-1 text-xs text-textSecondary">
          Slug
          <input name="slug" placeholder="auto from name" className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-textPrimary outline-none" />
        </label>
        <label className="grid gap-1 text-xs text-textSecondary">
          Parent
          <select name="parent_id" className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-textPrimary outline-none">
            <option value="">Root category</option>
            {flat.map((category) => (
              <option key={category.id} value={category.id}>
                {"- ".repeat(category.depth)}
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-textSecondary">
          Description
          <input name="description" className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-textPrimary outline-none" />
        </label>
        <label className="grid gap-1 text-xs text-textSecondary">
          Sort
          <input name="sort_order" type="number" defaultValue="0" className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-textPrimary outline-none" />
        </label>
        <label className="grid gap-1 text-xs text-textSecondary">
          Minimum paid price
          <input name="minimum_price" type="number" min="0" step="0.01" defaultValue="0" className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-textPrimary outline-none" />
        </label>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-textSecondary">
            <input name="is_active" type="checkbox" defaultChecked className="size-4 accent-primary" />
            Active
          </label>
          <button disabled={creating} type="submit" className={actionButtonClass("primary")}>
            <Plus className="size-4" />
            Create
          </button>
        </div>
      </form>

      <label className="flex items-center gap-2 rounded-2xl border border-border bg-surface px-3 py-2 text-sm text-textSecondary">
        <Search className="size-4" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search categories..."
          className="min-w-0 flex-1 bg-transparent text-textPrimary outline-none placeholder:text-textSecondary"
        />
      </label>

      {state === "error" ? <ErrorState message="Categories could not load." /> : null}
      {state === "loading" ? <LoadingState label="Loading categories..." /> : null}
      {state === "ready" && filtered.length === 0 ? <EmptyState title="No categories found" description="Create the first category above." /> : null}

      {state === "ready" && filtered.length > 0 ? (
        <div className="grid gap-3">
          {filtered.map((category) => (
            <article key={category.id} className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-textPrimary">
                      {"- ".repeat(category.depth)}
                      {category.name}
                    </p>
                    <StatusBadge value={category.is_active ?? true} />
                  </div>
                  <p className="mt-1 truncate text-xs text-textSecondary">/{category.slug}</p>
                  <p className="mt-2 text-sm text-textSecondary">{category.description || "No description."}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button disabled={busyId === category.id} type="button" onClick={() => remove(category.id)} className={actionButtonClass("danger")}>
                    <Trash2 className="size-4" />
                    Delete
                  </button>
                  <Link href={`/admin/categories/${category.id}`} className={actionButtonClass("neutral")}>
                    Edit
                    <ArrowRight className="size-4" />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
