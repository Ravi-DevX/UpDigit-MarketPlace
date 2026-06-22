"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BadgeDollarSign,
  Check,
  CheckCircle2,
  ExternalLink,
  FileText,
  ImageIcon,
  Link2,
  Loader2,
  MessageSquare,
  Package,
  Save,
  Settings2,
  SlidersHorizontal,
  Tag,
  Trash2,
  UploadCloud,
  Video,
  X,
} from "lucide-react";
import {
  CreateProductInput,
  deleteProduct,
  deleteProductMedia,
  fetchCategories,
  fetchSellerProductBySlug,
  fetchProductMedia,
  updateProduct,
  uploadProductMedia,
} from "@/lib/api";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { demoCategories } from "@/lib/demo";
import { cn } from "@/lib/utils";
import type { Category, Product, ProductMedia } from "@/types/marketplace";

type EditorTab = "basics" | "media" | "description" | "filtering" | "payment" | "engagement" | "advanced";
type Dependency = { name: string; link: string; required: boolean; paid: boolean };

const tabs: Array<{ id: EditorTab; label: string; icon: typeof Package }> = [
  { id: "basics", label: "Basics", icon: Package },
  { id: "media", label: "Media", icon: ImageIcon },
  { id: "description", label: "Description", icon: FileText },
  { id: "filtering", label: "Filtering", icon: SlidersHorizontal },
  { id: "payment", label: "Payment", icon: BadgeDollarSign },
  { id: "engagement", label: "Engagement", icon: MessageSquare },
  { id: "advanced", label: "Advanced", icon: Settings2 },
];

const defaultOptions: Record<string, string[]> = {
  types: ["Gameplay", "Economy", "Chat", "Protection", "Monetization", "World", "Minigame", "Staff", "Anticheat", "GUI", "Library", "Patch", "Equipment", "Food", "Magic", "Mobs", "Social", "Storage", "Technology", "Adventure", "Decoration", "Shop", "Core", "Reward", "Discord", "Fun", "Optimization"],
  game_modes: ["Survival", "Factions", "Skyblock", "Oneblock", "Prison", "Creative", "Towny", "Earth", "Gens", "Hub & lobby", "Minigame", "Pixelmon & Cobblemon", "Lifesteal", "UHC", "KitPVP", "BoxPVP", "Practice", "Bedwars", "Skywars", "Anarchy", "CityBuild", "Economy", "Modded", "Hardcore", "Parkour", "Roleplay"],
  supported_software: ["Bukkit", "Spigot", "Paper", "Sponge", "Bungee", "Folia", "Velocity", "Minestom", "Purpur", "Mohist", "Arclight"],
  supported_versions: ["26.2", "26.1.2", "26.1.1", "26.1", "1.21.11", "1.21.10", "1.21.9", "1.21.8", "1.21.7", "1.21.6", "1.21.5", "1.21.4", "1.21.3", "1.21.2", "1.21.1", "1.21", "1.20.6", "1.20.4", "1.20", "1.19", "1.18", "1.17", "1.16", "1.15", "1.14", "1.13", "1.12", "1.11", "1.10", "1.9", "1.8", "1.7"],
  supported_languages: ["This product contains no user-facing text", "English", "Spanish", "Russian", "German", "French", "Portuguese", "Polish", "Turkish", "Chinese", "Indonesian", "Italian", "Vietnamese", "Dutch", "Korean", "Czech", "Thai", "Hungarian", "Arabic", "Japanese", "Ukrainian", "Swedish", "Danish", "Romanian", "Slovak", "Hebrew", "Lithuanian"],
};

function flattenCategories(categories: Category[]): Category[] {
  return categories.flatMap((category) => [category, ...flattenCategories(category.children ?? [])]);
}

function findCategoryPath(categories: Category[], categoryId?: string | null) {
  for (const game of categories) {
    if (game.id === categoryId) return { game, category: game };
    const category = flattenCategories(game.children ?? []).find((item) => item.id === categoryId);
    if (category) return { game, category };
  }
  return { game: null, category: null };
}

function normalizeSlug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/(^-|-$)/g, "").slice(0, 64);
}

function productSlugBase(product: Product) {
  const suffix = product.public_id ? `-${product.public_id}` : "";
  return suffix && product.slug.endsWith(suffix) ? product.slug.slice(0, -suffix.length) : product.slug;
}

function stringArray(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function metadataString(metadata: Record<string, unknown> | null | undefined, key: string, fallback = "") {
  const value = metadata?.[key];
  return typeof value === "string" ? value : fallback;
}

function metadataBool(metadata: Record<string, unknown> | null | undefined, key: string, fallback = false) {
  const value = metadata?.[key];
  return typeof value === "boolean" ? value : fallback;
}

function metadataDependencies(metadata: Record<string, unknown> | null | undefined): Dependency[] {
  const value = metadata?.dependencies;
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const dependency = item as Record<string, unknown>;
    const name = typeof dependency.name === "string" ? dependency.name : "";
    if (!name) return [];
    return [{
      name,
      link: typeof dependency.link === "string" ? dependency.link : "",
      required: dependency.required !== false,
      paid: dependency.paid === true,
    }];
  });
}

function apiError(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "response" in error) {
    const data = (error as { response?: { data?: { error?: string } } }).response?.data;
    if (data?.error) return data.error;
  }
  return fallback;
}

export default function SellerProductEditPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<Category[]>(demoCategories);
  const [gallery, setGallery] = useState<ProductMedia[]>([]);
  const [activeTab, setActiveTab] = useState<EditorTab>("basics");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [gameId, setGameId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [thumbnailURL, setThumbnailURL] = useState("");
  const [coverMode, setCoverMode] = useState<"text" | "custom">("custom");
  const [displayCover, setDisplayCover] = useState(true);

  const [carouselEnabled, setCarouselEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [demoURL, setDemoURL] = useState("");
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [dependencyName, setDependencyName] = useState("");
  const [dependencyLink, setDependencyLink] = useState("");
  const [discordURL, setDiscordURL] = useState("");
  const [githubURL, setGithubURL] = useState("");
  const [wikiURL, setWikiURL] = useState("");

  const [resourceTypes, setResourceTypes] = useState<string[]>([]);
  const [gameModes, setGameModes] = useState<string[]>([]);
  const [software, setSoftware] = useState<string[]>([]);
  const [versions, setVersions] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>(["English"]);
  const [openSource, setOpenSource] = useState(false);
  const [drmFree, setDrmFree] = useState(true);
  const [unobfuscated, setUnobfuscated] = useState(true);
  const [originalCredit, setOriginalCredit] = useState("");

  const [freeProduct, setFreeProduct] = useState(true);
  const [price, setPrice] = useState("0");
  const [autoConversation, setAutoConversation] = useState(false);
  const [conversationTitle, setConversationTitle] = useState("");
  const [conversationMessage, setConversationMessage] = useState("");
  const [lockConversation, setLockConversation] = useState(false);
  const [discussionLocked, setDiscussionLocked] = useState(false);
  const [supportLink, setSupportLink] = useState("");
  const [purchaseMessage, setPurchaseMessage] = useState("");
  const [visibility, setVisibility] = useState<"published" | "unlisted" | "unpublished">("published");
  const [sourceURL, setSourceURL] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const [loadedProduct, loadedCategories] = await Promise.all([
          fetchSellerProductBySlug(params.id),
          fetchCategories().then((items) => items.length ? items : demoCategories).catch(() => demoCategories),
        ]);
        const media = await fetchProductMedia(loadedProduct.slug).catch(() => []);
        if (!active) return;
        const metadata = loadedProduct.metadata;
        setProduct(loadedProduct);
        setCategories(loadedCategories);
        setGallery(media.filter((item) => item.media_type === "gallery"));
        setTitle(loadedProduct.title);
        setSummary(loadedProduct.short_description ?? "");
        setDescription(loadedProduct.description ?? "");
        setSlug(productSlugBase(loadedProduct));
        setTags(loadedProduct.tags ?? []);
        setThumbnailURL(loadedProduct.thumbnail_url ?? loadedProduct.banner_url ?? "");
        setDemoURL(loadedProduct.demo_url ?? "");
        setSourceURL(loadedProduct.source_url ?? "");
        const path = findCategoryPath(loadedCategories, loadedProduct.category_id);
        setGameId(path.game?.id ?? "");
        setCategoryId(path.category?.id ?? "");
        setCoverMode(metadataString(metadata, "cover_mode", "custom") === "text" ? "text" : "custom");
        setDisplayCover(metadataBool(metadata, "display_cover_on_product_page", true));
        setCarouselEnabled(metadataBool(metadata, "carousel_enabled", true));
        setVideoEnabled(metadataBool(metadata, "video_demo_enabled", Boolean(loadedProduct.demo_url)));
        setDependencies(metadataDependencies(metadata));
        setDiscordURL(metadataString(metadata, "discord_url"));
        setGithubURL(metadataString(metadata, "github_url"));
        setWikiURL(metadataString(metadata, "wiki_url"));
        setResourceTypes(stringArray(metadata, "types"));
        setGameModes(stringArray(metadata, "game_modes"));
        setSoftware(stringArray(metadata, "supported_software"));
        setVersions(loadedProduct.supported_versions ?? []);
        setLanguages(stringArray(metadata, "supported_languages").length ? stringArray(metadata, "supported_languages") : ["English"]);
        setOpenSource(metadataBool(metadata, "open_source"));
        setDrmFree(metadataBool(metadata, "drm_free", true));
        setUnobfuscated(metadataBool(metadata, "unobfuscated", true));
        setOriginalCredit(metadataString(metadata, "original_credit"));
        setFreeProduct(Number(loadedProduct.price) <= 0);
        setPrice(String(loadedProduct.price ?? 0));
        setAutoConversation(metadataBool(metadata, "auto_conversation"));
        setConversationTitle(metadataString(metadata, "conversation_title"));
        setConversationMessage(metadataString(metadata, "conversation_message"));
        setLockConversation(metadataBool(metadata, "lock_conversation"));
        setDiscussionLocked(metadataBool(metadata, "discussion_locked"));
        setSupportLink(metadataString(metadata, "support_link"));
        setPurchaseMessage(metadataString(metadata, "purchase_message"));
        const storedVisibility = metadataString(metadata, "visibility", "published");
        setVisibility(storedVisibility === "unlisted" || storedVisibility === "unpublished" ? storedVisibility : "published");
      } catch {
        if (active) setError("Could not load this product.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [params.id]);

  const games = categories;
  const selectedGame = games.find((item) => item.id === gameId) ?? null;
  const selectedCategory = flattenCategories(categories).find((item) => item.id === categoryId) ?? null;
  const categoryOptions = (key: string) => {
    const configured = selectedCategory?.publishing_config?.[key];
    return Array.isArray(configured) && configured.some((item) => typeof item === "string")
      ? configured.filter((item): item is string => typeof item === "string")
      : defaultOptions[key];
  };
  const minimumPrice = Number(selectedCategory?.minimum_price || 0);
  const priceValue = freeProduct ? 0 : Number(price || 0);

  const metadata = useMemo<Record<string, unknown>>(() => ({
    ...(product?.metadata ?? {}),
    cover_mode: coverMode,
    display_cover_on_product_page: displayCover,
    carousel_enabled: carouselEnabled,
    video_demo_enabled: videoEnabled,
    types: resourceTypes,
    game_modes: gameModes,
    supported_software: software,
    supported_languages: languages,
    open_source: openSource,
    drm_free: drmFree,
    unobfuscated,
    original_credit: originalCredit.trim(),
    dependencies,
    discord_url: discordURL.trim(),
    github_url: githubURL.trim(),
    wiki_url: wikiURL.trim(),
    auto_conversation: autoConversation,
    conversation_title: conversationTitle.trim(),
    conversation_message: conversationMessage.trim(),
    lock_conversation: lockConversation,
    discussion_locked: discussionLocked,
    support_link: supportLink.trim(),
    purchase_message: purchaseMessage.trim(),
    visibility,
  }), [autoConversation, carouselEnabled, conversationMessage, conversationTitle, coverMode, dependencies, discordURL, discussionLocked, displayCover, drmFree, gameModes, githubURL, languages, lockConversation, openSource, originalCredit, product?.metadata, purchaseMessage, resourceTypes, software, supportLink, unobfuscated, videoEnabled, visibility, wikiURL]);

  const buildPayload = (status?: CreateProductInput["status"]): CreateProductInput => ({
    title: title.trim(),
    slug: normalizeSlug(slug || title),
    short_description: summary.trim(),
    description: description.trim() || "<p>Draft description.</p>",
    category_id: categoryId || undefined,
    price: priceValue,
    status: status ?? ((product?.status as CreateProductInput["status"]) || "draft"),
    thumbnail_url: thumbnailURL || undefined,
    banner_url: thumbnailURL || undefined,
    demo_url: videoEnabled && demoURL.trim() ? demoURL.trim() : undefined,
    source_url: sourceURL.trim() || undefined,
    tags,
    supported_versions: versions,
    metadata,
  });

  const saveProduct = async (status?: CreateProductInput["status"], successMessage = "Product changes saved.") => {
    if (!product) return null;
    if (!title.trim() || title.trim().length > 40) {
      setError("Title is required and must be 40 characters or fewer.");
      setActiveTab("basics");
      return null;
    }
    if (!summary.trim()) {
      setError("A one-line summary is required.");
      setActiveTab("basics");
      return null;
    }
    if (!freeProduct && minimumPrice > 0 && priceValue < minimumPrice) {
      setError(`The minimum paid price for ${selectedCategory?.name || "this category"} is $${minimumPrice.toFixed(2)}.`);
      setActiveTab("payment");
      return null;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const updated = await updateProduct(product.slug, buildPayload(status));
      setProduct(updated);
      setSlug(productSlugBase(updated));
      setMessage(successMessage);
      if (updated.slug !== product.slug) router.replace(`/seller/products/${updated.slug}/edit`);
      return updated;
    } catch (caught) {
      setError(apiError(caught, "Could not save product changes."));
      return null;
    } finally {
      setSaving(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void saveProduct();
  };

  const uploadCover = async (file?: File) => {
    if (!file || !product) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("Cover images must be 10 MB or smaller.");
      return;
    }
    setUploadingCover(true);
    setError("");
    try {
      const media = await uploadProductMedia(product.slug, file, "cover");
      const updated = await updateProduct(product.slug, { ...buildPayload(), thumbnail_url: media.media_url, banner_url: media.media_url, metadata: { ...metadata, cover_mode: "custom" } });
      setProduct(updated);
      setThumbnailURL(media.media_url);
      setCoverMode("custom");
      setMessage("Cover image uploaded.");
    } catch (caught) {
      setError(apiError(caught, "Could not upload the cover image."));
    } finally {
      setUploadingCover(false);
    }
  };

  const uploadGallery = async (files: FileList | null) => {
    if (!files || !product) return;
    const available = Math.max(0, 15 - gallery.length);
    setUploadingGallery(true);
    setError("");
    try {
      const uploaded: ProductMedia[] = [];
      for (const file of Array.from(files).slice(0, available)) {
        uploaded.push(await uploadProductMedia(product.slug, file, "gallery"));
      }
      setGallery((items) => [...items, ...uploaded]);
      setMessage(`${uploaded.length} gallery image${uploaded.length === 1 ? "" : "s"} uploaded.`);
    } catch (caught) {
      setError(apiError(caught, "Could not upload gallery images."));
    } finally {
      setUploadingGallery(false);
    }
  };

  const removeGalleryImage = async (media: ProductMedia) => {
    if (!product) return;
    try {
      await deleteProductMedia(product.slug, media.id);
      setGallery((items) => items.filter((item) => item.id !== media.id));
    } catch {
      setError("Could not delete this gallery image.");
    }
  };

  const uploadEditorImage = async (file: File) => {
    if (!product) throw new Error("Product is not loaded.");
    return (await uploadProductMedia(product.slug, file, "description")).media_url;
  };

  const addTag = (raw: string) => {
    const next = raw.trim().toLowerCase().replace(/\s+/g, " ");
    if (next && !tags.includes(next) && tags.length < 15) setTags((items) => [...items, next]);
    setTagInput("");
  };

  const removeProduct = async () => {
    if (!product || deleteConfirm !== "DELETE") return;
    setSaving(true);
    try {
      await deleteProduct(product.slug);
      router.push("/seller/products");
    } catch {
      setError("Could not delete this product.");
      setSaving(false);
    }
  };

  if (loading) return <div className="py-16 text-center text-sm text-textSecondary">Loading product editor...</div>;
  if (!product) return <div className="border border-danger/40 bg-danger/10 p-4 text-sm text-danger">{error || "Product could not be loaded."}</div>;

  return (
    <form onSubmit={submit} className="space-y-5">
      <header className="border-b border-border pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">Product editor</p>
            <h1 className="mt-2 truncate text-2xl font-semibold text-textPrimary">{title || product.title}</h1>
            <p className="mt-2 line-clamp-2 max-w-3xl text-sm text-textSecondary">{summary || "Add a short product summary."}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link href={`/products/${product.slug}`} className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm text-textSecondary hover:text-textPrimary">
              <ExternalLink className="size-4" /> View product
            </Link>
            <button type="submit" disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save changes
            </button>
            {product.status !== "approved" && product.status !== "pending" ? (
              <button type="button" onClick={() => void saveProduct("pending", "Product sent for review.")} disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-md border border-primary/40 px-4 text-sm text-primary disabled:opacity-50">
                <CheckCircle2 className="size-4" /> Send for review
              </button>
            ) : (
              <span className={cn("inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm", product.status === "approved" ? "border-success/30 bg-success/10 text-success" : "border-warning/30 bg-warning/10 text-warning")}>
                <CheckCircle2 className="size-4" /> {product.status === "approved" ? "Approved" : "In review"}
              </span>
            )}
          </div>
        </div>
      </header>

      <nav className="overflow-x-auto border-b border-border" aria-label="Product editor sections">
        <div className="flex min-w-max gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={cn("inline-flex h-11 items-center gap-2 border-b-2 px-3 text-sm transition", activeTab === tab.id ? "border-primary text-textPrimary" : "border-transparent text-textSecondary hover:text-textPrimary")}>
                <Icon className="size-4" /> {tab.label}
              </button>
            );
          })}
        </div>
      </nav>

      {error ? <div className="border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div> : null}
      {message ? <div className="border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">{message}</div> : null}

      <main className="mx-auto w-full max-w-5xl">
        {activeTab === "basics" ? (
          <EditorSection title="Basics" description="The identity customers see in discovery, search, and the product header.">
            <Field label="Title" required help={`${title.length}/40 characters. Keep it factual and avoid prices, sales language, emojis, or excessive capitals.`}>
              <input value={title} maxLength={40} onChange={(event) => setTitle(event.target.value)} className="field-input" />
            </Field>
            <Field label="Summary" required help={`${summary.length}/127 characters. Provide one concise line describing the product.`}>
              <input value={summary} maxLength={127} onChange={(event) => setSummary(event.target.value)} className="field-input" />
            </Field>
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Game" required>
                <select value={gameId} onChange={(event) => { setGameId(event.target.value); setCategoryId(""); }} className="field-input">
                  <option value="">Select a game</option>
                  {games.map((game) => <option key={game.id} value={game.id}>{game.name}</option>)}
                </select>
              </Field>
              <Field label="Category" required help={selectedCategory && minimumPrice > 0 ? `Minimum paid price: $${minimumPrice.toFixed(2)}` : undefined}>
                <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="field-input">
                  <option value="">Select a category</option>
                  {(selectedGame?.children ?? []).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Tags" required help="Add up to 15 focused search terms. Press Enter or comma after each tag.">
              <div className="rounded-md border border-border bg-elevated p-2 focus-within:border-primary/60">
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-xs text-textPrimary">
                      {tag}<button type="button" onClick={() => setTags((items) => items.filter((item) => item !== tag))} aria-label={`Remove ${tag}`}><X className="size-3 text-textSecondary" /></button>
                    </span>
                  ))}
                  <input value={tagInput} onChange={(event) => setTagInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === ",") { event.preventDefault(); addTag(tagInput); } }} onBlur={() => addTag(tagInput)} placeholder={tags.length ? "Add another tag" : "economy, investment, gui"} className="min-w-[180px] flex-1 bg-transparent px-1 py-1 text-sm text-textPrimary outline-none" />
                </div>
              </div>
            </Field>
            <Field label="Cover image" required help="Custom covers are cropped to 2:1. Use at least 1024x512 pixels.">
              <div className="grid gap-3 sm:grid-cols-2">
                <ChoiceCard active={coverMode === "text"} onClick={() => setCoverMode("text")} title="Use text cover" description="Generate a clean title-based cover on the product page." />
                <ChoiceCard active={coverMode === "custom"} onClick={() => setCoverMode("custom")} title="Use custom cover" description="Recommended for a recognizable product identity." />
              </div>
              <div className="mt-3 overflow-hidden rounded-md border border-border bg-surface">
                {coverMode === "custom" && thumbnailURL ? (
                  <img src={thumbnailURL} alt="Product cover" className="aspect-[2/1] w-full object-cover" />
                ) : (
                  <div className="flex aspect-[2/1] items-center justify-center bg-[var(--bg-panel)] px-8 text-center">
                    <span className="text-balance text-2xl font-semibold text-textPrimary sm:text-3xl">{title || "Product title"}</span>
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">
                    {uploadingCover ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />} Attach cover
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void uploadCover(event.target.files?.[0])} className="sr-only" />
                  </label>
                  {thumbnailURL ? <button type="button" onClick={() => setThumbnailURL("")} className="inline-flex items-center gap-2 text-sm text-danger"><Trash2 className="size-4" /> Remove</button> : null}
                </div>
              </div>
              <ToggleRow checked={displayCover} onChange={setDisplayCover} title="Display cover on product page" description="Shows the cover above the description, never as a small logo beside the title." />
            </Field>
          </EditorSection>
        ) : null}

        {activeTab === "media" ? (
          <EditorSection title="Media" description="Show the actual product with a focused image carousel and optional video demo.">
            <ToggleRow checked={carouselEnabled} onChange={setCarouselEnabled} title="Enable image carousel" description="Display up to 15 images or GIFs at the top of the product overview." />
            {carouselEnabled ? (
              <Field label={`Gallery images (${gallery.length}/15)`} help="Recommended size: 1024x512 or larger. JPG, PNG, WEBP, and GIF are supported up to 10 MB.">
                <label className="flex min-h-28 cursor-pointer items-center justify-center gap-3 rounded-md border border-dashed border-border bg-surface text-sm text-textSecondary hover:border-primary/50 hover:text-textPrimary">
                  {uploadingGallery ? <Loader2 className="size-5 animate-spin text-primary" /> : <UploadCloud className="size-5 text-primary" />}
                  {uploadingGallery ? "Uploading images..." : "Choose gallery images"}
                  <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" disabled={gallery.length >= 15 || uploadingGallery} onChange={(event) => void uploadGallery(event.target.files)} className="sr-only" />
                </label>
                {gallery.length ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {gallery.map((media) => (
                      <div key={media.id} className="group relative overflow-hidden rounded-md border border-border">
                        <img src={media.media_url} alt="Gallery item" className="aspect-[2/1] w-full object-cover" />
                        <button type="button" onClick={() => void removeGalleryImage(media)} title="Delete image" className="absolute right-2 top-2 inline-flex size-8 items-center justify-center rounded-md bg-black/75 text-textPrimary opacity-0 transition group-hover:opacity-100"><Trash2 className="size-4" /></button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </Field>
            ) : null}
            <ToggleRow checked={videoEnabled} onChange={setVideoEnabled} title="Enable video demo" description="Embed a YouTube video after the image carousel." />
            {videoEnabled ? (
              <Field label="YouTube URL" required>
                <div className="relative"><Video className="absolute left-3 top-3 size-4 text-textSecondary" /><input value={demoURL} onChange={(event) => setDemoURL(event.target.value)} placeholder="https://www.youtube.com/watch?v=..." className="field-input pl-10" /></div>
              </Field>
            ) : null}
          </EditorSection>
        ) : null}

        {activeTab === "description" ? (
          <EditorSection title="Description" description="Explain the product clearly and disclose everything customers need before downloading.">
            <Field label="Description" required>
              <RichTextEditor value={description} onChange={setDescription} onUploadImage={uploadEditorImage} placeholder="Describe features, setup, commands, requirements, and support..." minHeight={500} />
            </Field>
            <Field label="Dependencies" help="Disclose external downloads, paid requirements, and license-key services with a publicly accessible link.">
              <div className="space-y-2">
                {dependencies.map((dependency, index) => (
                  <div key={`${dependency.name}-${index}`} className="flex flex-col gap-2 rounded-md border border-border p-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1"><p className="font-medium text-textPrimary">{dependency.name}</p><p className="truncate text-xs text-textSecondary">{dependency.link || "No verification link"}</p></div>
                    <span className="text-xs text-textSecondary">{dependency.required ? "Required" : "Optional"} / {dependency.paid ? "Paid" : "Free"}</span>
                    <button type="button" onClick={() => setDependencies((items) => items.filter((_, itemIndex) => itemIndex !== index))} className="text-danger"><Trash2 className="size-4" /></button>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1.4fr_auto]">
                <input value={dependencyName} onChange={(event) => setDependencyName(event.target.value)} placeholder="Dependency name" className="field-input" />
                <input value={dependencyLink} onChange={(event) => setDependencyLink(event.target.value)} placeholder="https://..." className="field-input" />
                <button type="button" onClick={() => { if (dependencyName.trim()) { setDependencies((items) => [...items, { name: dependencyName.trim(), link: dependencyLink.trim(), required: true, paid: false }]); setDependencyName(""); setDependencyLink(""); } }} className="rounded-md border border-border px-4 text-sm text-textPrimary">Add</button>
              </div>
            </Field>
            <Field label="Custom links" help="Relevant links are displayed with the resource. Leave irrelevant fields empty.">
              <div className="grid gap-3"><input value={discordURL} onChange={(event) => setDiscordURL(event.target.value)} placeholder="Discord or support URL" className="field-input" /><input value={githubURL} onChange={(event) => setGithubURL(event.target.value)} placeholder="GitHub repository URL" className="field-input" /><input value={wikiURL} onChange={(event) => setWikiURL(event.target.value)} placeholder="Wiki or documentation URL" className="field-input" /></div>
            </Field>
          </EditorSection>
        ) : null}

        {activeTab === "filtering" ? (
          <EditorSection title="Filtering" description={`Discovery fields for ${selectedCategory?.name || "the selected category"}. Administrators can configure these options per category.`}>
            <ChoiceGrid title="Type" required options={categoryOptions("types")} selected={resourceTypes} onChange={setResourceTypes} max={3} help="Select up to three options that best describe this product." />
            <ChoiceGrid title="Game mode" options={categoryOptions("game_modes")} selected={gameModes} onChange={setGameModes} max={3} help="Select up to three game modes this product was specifically designed for." />
            <ChoiceGrid title="Supported software" required options={categoryOptions("supported_software")} selected={software} onChange={setSoftware} help="Select only software you have tested and can support." />
            <ChoiceGrid title="Supported versions" required options={categoryOptions("supported_versions")} selected={versions} onChange={setVersions} help="Select only versions verified to work." />
            <ChoiceGrid title="Supported languages" required options={categoryOptions("supported_languages")} selected={languages} onChange={setLanguages} help="Select languages fully included for end users." />
            <div className="grid gap-5 md:grid-cols-3">
              <YesNoField label="Open source" value={openSource} onChange={setOpenSource} />
              <YesNoField label="DRM-free" value={drmFree} onChange={setDrmFree} />
              <YesNoField label="Unobfuscated" value={unobfuscated} onChange={setUnobfuscated} />
            </div>
            <Field label="Crediting original" help="Credit the original author when this product is a permitted fork or modification.">
              <input value={originalCredit} onChange={(event) => setOriginalCredit(event.target.value)} placeholder="Original product or author URL" className="field-input" />
            </Field>
          </EditorSection>
        ) : null}

        {activeTab === "payment" ? (
          <EditorSection title="Payment" description="Choose whether customers download freely or purchase a license.">
            <div className="grid gap-3 sm:grid-cols-2">
              <ChoiceCard active={freeProduct} onClick={() => setFreeProduct(true)} title="Allow free downloads" description="Customers can download the latest release immediately." />
              <ChoiceCard active={!freeProduct} onClick={() => setFreeProduct(false)} title="Require payment" description="Customers must purchase a download license." />
            </div>
            {!freeProduct ? (
              <Field label="Price" required help={minimumPrice > 0 ? `This category requires a minimum price of $${minimumPrice.toFixed(2)} USD.` : "Enter the product price in USD."}>
                <div className="flex max-w-sm overflow-hidden rounded-md border border-border bg-elevated focus-within:border-primary/60"><span className="flex items-center border-r border-border px-3 text-textSecondary">$</span><input value={price} type="number" min={minimumPrice || 0.01} step="0.01" onChange={(event) => setPrice(event.target.value)} className="min-w-0 flex-1 bg-transparent px-3 py-3 text-textPrimary outline-none" /><span className="flex items-center border-l border-border px-3 text-xs text-textSecondary">USD</span></div>
              </Field>
            ) : (
              <div className="border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">This product will be available as a direct free download.</div>
            )}
          </EditorSection>
        ) : null}

        {activeTab === "engagement" ? (
          <EditorSection title="Engagement" description="Configure buyer communication and product support behavior.">
            <ToggleRow checked={autoConversation} onChange={setAutoConversation} title="Automatically create a conversation with buyers" description="Start one private conversation after a completed purchase." />
            {autoConversation ? (
              <div className="grid gap-4">
                <Field label="Conversation title" required><input value={conversationTitle} onChange={(event) => setConversationTitle(event.target.value)} placeholder="Thanks for purchasing {{product}}" className="field-input" /></Field>
                <Field label="Message" required help="Use {{user}} for the buyer username."><textarea value={conversationMessage} onChange={(event) => setConversationMessage(event.target.value)} rows={6} className="field-input resize-y" /></Field>
                <ToggleRow checked={lockConversation} onChange={setLockConversation} title="Lock conversation" description="Disallow replies to the automated conversation." />
              </div>
            ) : null}
            <ToggleRow checked={discussionLocked} onChange={setDiscussionLocked} title="Lock product discussions" description="Customers cannot start marketplace discussions for this product." />
            {discussionLocked ? <Field label="Custom support link"><input value={supportLink} onChange={(event) => setSupportLink(event.target.value)} placeholder="https://support.example.com" className="field-input" /></Field> : null}
            <Field label="Automatic purchase message" help={`${purchaseMessage.length}/1000 characters. Sent once after purchase.`}><textarea value={purchaseMessage} maxLength={1000} onChange={(event) => setPurchaseMessage(event.target.value)} rows={5} className="field-input resize-y" /></Field>
          </EditorSection>
        ) : null}

        {activeTab === "advanced" ? (
          <EditorSection title="Advanced" description="Manage resource visibility, identity, releases, source links, and deletion.">
            <Field label="Visibility">
              <div className="grid gap-3">
                <ChoiceCard active={visibility === "published"} onClick={() => setVisibility("published")} title="Published" description="Visible on marketplace discovery pages after approval." />
                <ChoiceCard active={visibility === "unlisted"} onClick={() => setVisibility("unlisted")} title="Unlisted" description="Accessible by direct link and excluded from discovery." />
                <ChoiceCard active={visibility === "unpublished"} onClick={() => setVisibility("unpublished")} title="Unpublished" description="Hidden from customers while you work on it." />
              </div>
            </Field>
            <div className="grid gap-5 md:grid-cols-[1fr_180px]">
              <Field label="URL slug" help="Editable URL name. The permanent product ID remains attached automatically."><input value={slug} maxLength={64} onChange={(event) => setSlug(normalizeSlug(event.target.value))} className="field-input font-mono" /></Field>
              <Field label="Product ID" help="Assigned permanently."><input value={product.public_id ?? ""} readOnly className="field-input cursor-not-allowed font-mono text-textSecondary" /></Field>
            </div>
            <Field label="Source repository"><div className="relative"><Link2 className="absolute left-3 top-3 size-4 text-textSecondary" /><input value={sourceURL} onChange={(event) => setSourceURL(event.target.value)} placeholder="https://github.com/..." className="field-input pl-10" /></div></Field>
            <div className="flex flex-col gap-3 border-y border-border py-5 sm:flex-row sm:items-center sm:justify-between">
              <div><h3 className="font-medium text-textPrimary">Product releases</h3><p className="mt-1 text-sm text-textSecondary">Upload a new file, write release notes, and review existing versions.</p></div>
              <Link href={`/seller/products/${product.slug}/versions`} className="inline-flex h-10 items-center justify-center rounded-md border border-border px-4 text-sm text-textPrimary">Manage releases</Link>
            </div>
            <div className="border border-danger/35 bg-danger/5 p-4">
              <h3 className="font-medium text-danger">Delete product permanently</h3>
              <p className="mt-1 text-sm text-textSecondary">This deletes the product, versions, media, and associated records. This cannot be undone.</p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row"><input value={deleteConfirm} onChange={(event) => setDeleteConfirm(event.target.value)} placeholder="Type DELETE" className="field-input sm:max-w-xs" /><button type="button" disabled={deleteConfirm !== "DELETE" || saving} onClick={() => void removeProduct()} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-danger px-4 text-sm font-medium text-primary-foreground disabled:opacity-40"><Trash2 className="size-4" /> Delete permanently</button></div>
            </div>
          </EditorSection>
        ) : null}
      </main>
    </form>
  );
}

function EditorSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <section className="space-y-7 pb-10"><div><h2 className="text-xl font-semibold text-textPrimary">{title}</h2><p className="mt-1 text-sm text-textSecondary">{description}</p></div>{children}</section>;
}

function Field({ label, help, required, children }: { label: string; help?: string; required?: boolean; children: ReactNode }) {
  return <div><label className="mb-2 block text-sm font-medium text-textPrimary">{label}{required ? <span className="ml-1 text-primary">Required</span> : null}</label>{children}{help ? <p className="mt-2 text-xs leading-5 text-textSecondary">{help}</p> : null}</div>;
}

function ChoiceCard({ active, onClick, title, description }: { active: boolean; onClick: () => void; title: string; description: string }) {
  return <button type="button" onClick={onClick} className={cn("flex min-h-20 items-start gap-3 rounded-md border p-3 text-left transition", active ? "border-primary bg-primary/10" : "border-border bg-surface hover:border-[var(--border-hover)]")}><span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border", active ? "border-primary bg-primary" : "border-border")}>{active ? <Check className="size-3 text-textPrimary" /> : null}</span><span><span className="block text-sm font-medium text-textPrimary">{title}</span><span className="mt-1 block text-xs leading-5 text-textSecondary">{description}</span></span></button>;
}

function ToggleRow({ checked, onChange, title, description }: { checked: boolean; onChange: (value: boolean) => void; title: string; description: string }) {
  return <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-5 border-y border-border py-4 text-left"><span><span className="block text-sm font-medium text-textPrimary">{title}</span><span className="mt-1 block text-xs leading-5 text-textSecondary">{description}</span></span><span className={cn("relative h-6 w-11 shrink-0 rounded-full transition", checked ? "bg-primary" : "bg-white/15")}><span className={cn("absolute top-1 size-4 rounded-full bg-white transition", checked ? "left-6" : "left-1")} /></span></button>;
}

function ChoiceGrid({ title, required, options, selected, onChange, max, help }: { title: string; required?: boolean; options: string[]; selected: string[]; onChange: (items: string[]) => void; max?: number; help: string }) {
  const toggle = (option: string) => {
    if (selected.includes(option)) onChange(selected.filter((item) => item !== option));
    else if (!max || selected.length < max) onChange([...selected, option]);
  };
  return <Field label={title} required={required} help={`${help}${max ? ` Select up to ${max}.` : ""}`}><div className="flex flex-wrap gap-2">{options.map((option) => { const active = selected.includes(option); return <button key={option} type="button" onClick={() => toggle(option)} className={cn("rounded-md border px-3 py-2 text-xs transition", active ? "border-primary bg-primary/15 text-primary-foreground" : "border-border text-textSecondary hover:border-[var(--border-hover)] hover:text-textPrimary")}>{option}</button>; })}</div></Field>;
}

function YesNoField({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return <Field label={label} required><div className="grid grid-cols-2 overflow-hidden rounded-md border border-border"><button type="button" onClick={() => onChange(true)} className={cn("px-3 py-2 text-sm", value ? "bg-primary text-primary-foreground" : "text-textSecondary")}>Yes</button><button type="button" onClick={() => onChange(false)} className={cn("border-l border-border px-3 py-2 text-sm", !value ? "bg-primary text-primary-foreground" : "text-textSecondary")}>No</button></div></Field>;
}
