"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { deleteAdminCategory, fetchAdminCategories, updateAdminCategory } from "@/lib/api";
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

function configList(category: Category, key: string) {
  const value = category.publishing_config?.[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").join(", ") : "";
}

function formList(form: FormData, key: string) {
  return String(form.get(key) || "")
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function AdminCategoryDetailPage({ params }: { params: { id: string } }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState<Category | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setState("loading");
    try {
      const tree = await fetchAdminCategories();
      const flat = flatten(tree);
      setCategories(tree);
      setCategory(flat.find((item) => item.id === params.id || item.slug === params.id) ?? null);
      setState("ready");
    } catch {
      setState("error");
    }
  };

  useEffect(() => {
    void load();
  }, [params.id]);

  const flat = useMemo(() => flatten(categories), [categories]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!category) {
      return;
    }
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await updateAdminCategory(category.id, {
        name: String(form.get("name") || "").trim(),
        slug: String(form.get("slug") || "").trim(),
        parent_id: String(form.get("parent_id") || "").trim() || null,
        description: String(form.get("description") || "").trim() || null,
        icon_url: String(form.get("icon_url") || "").trim() || null,
        sort_order: Number(form.get("sort_order") || 0),
        is_active: form.get("is_active") === "on",
        minimum_price: Number(form.get("minimum_price") || 0),
        publishing_config: {
          types: formList(form, "types"),
          game_modes: formList(form, "game_modes"),
          supported_software: formList(form, "supported_software"),
          supported_versions: formList(form, "supported_versions"),
          supported_languages: formList(form, "supported_languages"),
        },
      });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!category) {
      return;
    }
    setBusy(true);
    try {
      await deleteAdminCategory(category.id);
      window.location.href = "/admin/categories";
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Category detail"
        title={category?.name || "Category"}
        description={`Category ID: ${params.id}`}
        action={
          <Link href="/admin/categories" className={actionButtonClass("neutral")}>
            <ArrowLeft className="size-4" />
            Back to categories
          </Link>
        }
      />

      {state === "error" ? <ErrorState message="Category detail could not load." /> : null}
      {state === "loading" ? <LoadingState label="Loading category detail..." /> : null}
      {state === "ready" && !category ? <EmptyState title="Category not found" description="This category was not returned by the admin categories API." /> : null}

      {state === "ready" && category ? (
        <form onSubmit={submit} className="grid gap-4 lg:grid-cols-[0.75fr_1.25fr]">
          <article className="rounded-2xl border border-border bg-surface p-5">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <StatusBadge value={category.is_active ?? true} />
              <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-textSecondary">
                /{category.slug}
              </span>
            </div>
            <p className="text-sm leading-6 text-textSecondary">{category.description || "No description."}</p>
            <button disabled={busy} type="button" onClick={remove} className={`${actionButtonClass("danger")} mt-5 w-full`}>
              <Trash2 className="size-4" />
              Delete category
            </button>
          </article>

          <article className="rounded-2xl border border-border bg-surface p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1 text-xs text-textSecondary">
                Name
                <input name="name" defaultValue={category.name} required className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-textPrimary outline-none" />
              </label>
              <label className="grid gap-1 text-xs text-textSecondary">
                Slug
                <input name="slug" defaultValue={category.slug} required className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-textPrimary outline-none" />
              </label>
              <label className="grid gap-1 text-xs text-textSecondary">
                Parent
                <select name="parent_id" defaultValue={category.parent_id || ""} className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-textPrimary outline-none">
                  <option value="">Root category</option>
                  {flat
                    .filter((item) => item.id !== category.id)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {"- ".repeat(item.depth)}
                        {item.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs text-textSecondary">
                Sort order
                <input name="sort_order" type="number" defaultValue={category.sort_order || 0} className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-textPrimary outline-none" />
              </label>
              <label className="grid gap-1 text-xs text-textSecondary">
                Minimum paid price (USD)
                <input name="minimum_price" type="number" min="0" step="0.01" defaultValue={category.minimum_price || 0} className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-textPrimary outline-none" />
              </label>
              <label className="grid gap-1 text-xs text-textSecondary sm:col-span-2">
                Description
                <textarea name="description" defaultValue={category.description || ""} rows={4} className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-textPrimary outline-none" />
              </label>
              <label className="grid gap-1 text-xs text-textSecondary sm:col-span-2">
                Icon URL
                <input name="icon_url" defaultValue={category.icon_url || ""} className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-textPrimary outline-none" />
              </label>
              <div className="border-t border-border pt-4 sm:col-span-2">
                <h3 className="text-sm font-semibold text-textPrimary">Product publishing options</h3>
                <p className="mt-1 text-xs text-textSecondary">Comma-separated options shown when sellers publish products in this category. Empty fields use marketplace defaults.</p>
              </div>
              {[
                ["types", "Resource types"],
                ["game_modes", "Game modes"],
                ["supported_software", "Supported software"],
                ["supported_versions", "Supported versions"],
                ["supported_languages", "Supported languages"],
              ].map(([key, label]) => (
                <label key={key} className="grid gap-1 text-xs text-textSecondary sm:col-span-2">
                  {label}
                  <textarea name={key} defaultValue={configList(category, key)} rows={2} className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-textPrimary outline-none" />
                </label>
              ))}
              <label className="flex items-center gap-2 text-sm text-textSecondary">
                <input name="is_active" type="checkbox" defaultChecked={category.is_active ?? true} className="size-4 accent-primary" />
                Active category
              </label>
            </div>
            <button disabled={busy} type="submit" className={`${actionButtonClass("primary")} mt-5`}>
              <Save className="size-4" />
              Save category
            </button>
          </article>
        </form>
      ) : null}
    </section>
  );
}
