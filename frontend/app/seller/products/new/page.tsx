"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, PackagePlus } from "lucide-react";
import { createProduct, fetchCategories } from "@/lib/api";
import { demoCategories } from "@/lib/demo";
import { useAuthStore } from "@/store/auth";
import type { Category } from "@/types/marketplace";

const MAX_SHORT_DESCRIPTION = 127;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default function SellerNewProductPage() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const role = useAuthStore((state) => state.user?.role);
  const canCreateProducts = role === "seller" || role === "admin";

  const [categories, setCategories] = useState<Category[]>(demoCategories);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [name, setName] = useState("");
  const [gameId, setGameId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    fetchCategories()
      .then((items) => {
        if (!mounted) {
          return;
        }
        setCategories(items.length > 0 ? items : demoCategories);
      })
      .catch(() => {
        if (mounted) {
          setCategories(demoCategories);
        }
      })
      .finally(() => {
        if (mounted) {
          setLoadingCategories(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const games = useMemo(() => categories, [categories]);
  const selectedGame = games.find((game) => game.id === gameId);
  const gameCategories = selectedGame?.children ?? [];
  const selectedCategory = gameCategories.find((category) => category.id === categoryId);
  const shortDescriptionLength = shortDescription.length;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canCreateProducts) {
      setError("Seller access is required to create products.");
      return;
    }
    if (!name.trim() || !gameId || !categoryId || !shortDescription.trim()) {
      setError("Name, game, category, and short description are required.");
      return;
    }
    if (shortDescription.length > MAX_SHORT_DESCRIPTION) {
      setError(`Short description must be ${MAX_SHORT_DESCRIPTION} characters or fewer.`);
      return;
    }

    setSaving(true);
    setError("");
    try {
      const product = await createProduct({
        title: name.trim(),
        short_description: shortDescription.trim(),
        description: `<p>${escapeHtml(shortDescription.trim())}</p>`,
        category_id: categoryId,
        price: 0,
        status: "draft",
        tags: [selectedGame?.slug, selectedCategory?.slug].filter(Boolean) as string[],
      });
      router.push(`/seller/products/${product.slug}/edit`);
    } catch {
      setError("Could not create product draft. Check the selected category and try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-textPrimary">Add a New Product</h2>
        <p className="text-sm text-textSecondary">Please sign in before adding products.</p>
      </section>
    );
  }

  if (!canCreateProducts) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-textPrimary">Add a New Product</h2>
        <p className="text-sm text-textSecondary">Seller role required. Apply for seller access first.</p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-primary">Product draft</p>
        <h2 className="mt-2 text-3xl font-semibold text-textPrimary">Add a New Product</h2>
        <p className="mt-2 text-sm text-textSecondary">Create a new product and start selling to your customers.</p>
      </div>

      {error ? <div className="rounded-2xl border border-danger/50 bg-danger/10 p-3 text-sm text-danger">{error}</div> : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_0.7fr]">
        <form onSubmit={submit} className="rounded-2xl border border-border bg-surface p-5">
          <div className="border-b border-border pb-4">
            <h3 className="text-lg font-semibold text-textPrimary">Product Information</h3>
            <p className="mt-1 text-sm text-textSecondary">Enter the basic details for your new product.</p>
          </div>

          <div className="mt-5 grid gap-4">
            <label className="space-y-2 text-sm">
              <span className="text-textSecondary">Name *</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-textPrimary outline-none focus:border-primary/60"
                placeholder="New product"
                maxLength={200}
                required
              />
            </label>

            <label className="space-y-2 text-sm">
              <span className="text-textSecondary">Game *</span>
              <select
                value={gameId}
                onChange={(event) => {
                  setGameId(event.target.value);
                  setCategoryId("");
                }}
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-textPrimary outline-none focus:border-primary/60"
                required
              >
                <option value="">Select a game</option>
                {games.map((game) => (
                  <option key={game.id} value={game.id}>
                    {game.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm">
              <span className="text-textSecondary">Category *</span>
              <select
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                disabled={!gameId || loadingCategories}
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-textPrimary outline-none focus:border-primary/60 disabled:opacity-60"
                required
              >
                <option value="">{loadingCategories ? "Loading..." : gameId ? "Select a category" : "Select a game first"}</option>
                {gameCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm">
              <span className="flex items-center justify-between gap-3 text-textSecondary">
                <span>Short Description *</span>
                <span className={shortDescriptionLength > MAX_SHORT_DESCRIPTION ? "text-danger" : ""}>
                  {shortDescriptionLength}/{MAX_SHORT_DESCRIPTION}
                </span>
              </span>
              <textarea
                value={shortDescription}
                onChange={(event) => setShortDescription(event.target.value.slice(0, MAX_SHORT_DESCRIPTION))}
                rows={3}
                className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-textPrimary outline-none focus:border-primary/60"
                placeholder="Short description with 127 characters at maximum"
                required
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <PackagePlus className="size-4" />}
            Create Product Draft
          </button>
        </form>

        <aside className="rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-center gap-2 text-textPrimary">
            <CheckCircle2 className="size-5 text-success" />
            <h3 className="font-semibold">What happens next?</h3>
          </div>
          <div className="mt-4 space-y-3 text-sm leading-6 text-textSecondary">
            <p>- Your product will be created as a draft and will not be visible to customers yet.</p>
            <p>- You will be redirected to the product detail page to complete the setup.</p>
            <p>- Add images, versions, and other details before publishing.</p>
            <p>- Send it for review when you are ready to start selling.</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
