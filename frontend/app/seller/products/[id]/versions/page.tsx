"use client";

import { FormEvent, useEffect, useState } from "react";
import { FileArchive, Loader2, UploadCloud } from "lucide-react";
import { fetchProductVersions, fetchSellerProductBySlug, uploadProductMedia, uploadProductVersion } from "@/lib/api";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import type { Product, ProductVersion } from "@/types/marketplace";

export default function SellerProductVersionsPage({ params }: { params: { id: string } }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [versions, setVersions] = useState<ProductVersion[]>([]);
  const [versionTag, setVersionTag] = useState("1.0.0");
  const [updateTitle, setUpdateTitle] = useState("");
  const [changelog, setChangelog] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    const loaded = await fetchSellerProductBySlug(params.id);
    setProduct(loaded);
    const versionList = await fetchProductVersions(loaded.slug).catch(() => []);
    setVersions(versionList);
  };

  useEffect(() => {
    load().catch(() => setError("Could not load product versions."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!product || !file) {
      setError("Select a release file first.");
      return;
    }
    setUploading(true);
    setProgress(1);
    setError("");
    try {
      await uploadProductVersion(product.slug, { version_tag: versionTag, post_update: true, update_title: updateTitle, changelog, file }, setProgress);
      setFile(null);
      setUpdateTitle("");
      setChangelog("");
      setProgress(100);
      await load();
    } catch {
      setError("Upload failed. Check file type and seller permissions.");
    } finally {
      setUploading(false);
    }
  };

  const uploadEditorImage = async (image: File) => {
    if (!product) {
      throw new Error("Product is not loaded.");
    }
    const media = await uploadProductMedia(product.slug, image, "description");
    return media.media_url;
  };

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-primary">Release files</p>
        <h2 className="mt-2 text-2xl font-semibold text-textPrimary">Product versions</h2>
        <p className="mt-2 text-sm text-textSecondary">{product?.title ?? params.id}</p>
      </div>
      {error ? <div className="rounded-2xl border border-danger/50 bg-danger/10 p-3 text-sm text-danger">{error}</div> : null}
      <form onSubmit={submit} className="rounded-2xl border border-border bg-surface p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="text-textSecondary">Version tag</span>
            <input value={versionTag} onChange={(event) => setVersionTag(event.target.value)} className="w-full rounded-2xl border border-border bg-surface px-4 py-3 outline-none focus:border-primary/60" />
          </label>
          <label className="flex cursor-pointer items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-elevated px-4 py-3 text-sm text-textSecondary hover:border-primary/50">
            <UploadCloud className="size-4 text-primary" />
            {file ? file.name : "Choose release artifact"}
            <input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="sr-only" />
          </label>
          <label className="space-y-2 text-sm md:col-span-2">
            <span className="text-textSecondary">Update title</span>
            <input required value={updateTitle} onChange={(event) => setUpdateTitle(event.target.value)} maxLength={100} placeholder="What is new in this release?" className="w-full rounded-2xl border border-border bg-surface px-4 py-3 outline-none focus:border-primary/60" />
          </label>
          <div className="space-y-2 text-sm md:col-span-2">
            <span className="block text-textSecondary">Release Notes</span>
            <RichTextEditor
              value={changelog}
              onChange={setChangelog}
              onUploadImage={uploadEditorImage}
              placeholder="Explain what changed in this release..."
              minHeight={240}
            />
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
        <button type="submit" disabled={uploading} className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <FileArchive className="size-4" />}
          Upload version
        </button>
      </form>
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="border-b border-border px-4 py-3 text-xs uppercase tracking-[0.12em] text-textSecondary">Existing versions</div>
        <div className="divide-y divide-white/10">
          {versions.length === 0 ? (
            <p className="px-4 py-6 text-sm text-textSecondary">No versions uploaded yet.</p>
          ) : (
            versions.map((version) => (
              <div key={version.id} className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  <span className="block text-sm font-medium text-textPrimary">v{version.version_tag}</span>
                  <span className="block text-xs text-textSecondary">{version.file_name} · {version.file_size ? `${Math.round(version.file_size / 1024)} KB` : "size unknown"}</span>
                </span>
                <span className="text-xs text-textSecondary">{new Date(version.created_at).toLocaleDateString()}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
