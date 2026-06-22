"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, FileArchive, Loader2, Trash2, UploadCloud, X } from "lucide-react";
import { uploadProductMedia, uploadProductVersion } from "@/lib/api";

const RichTextEditor = dynamic(
  () => import("@/components/editor/RichTextEditor").then((module) => module.RichTextEditor),
  {
    ssr: false,
    loading: () => <div className="h-52 animate-pulse rounded-md border border-border bg-elevated" />,
  },
);

const artifactTypes = ".zip,.rar,.7z,.tar.gz,.jar,.pdf,.psd,.schematic,.schem,.png,.jpg,.jpeg,.html,.txt,.sk,.skr,.yml,.rbxl,.rbxlx,.rbxm,.rbxmx";

type ProductUpdateModalProps = {
  open: boolean;
  onClose: () => void;
  slug: string;
  productTitle: string;
  currentVersion?: string | null;
};

function formatBytes(bytes: number) {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export function ProductUpdateModal({ open, onClose, slug, productTitle, currentVersion }: ProductUpdateModalProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [versionTag, setVersionTag] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [postUpdate, setPostUpdate] = useState(true);
  const [updateTitle, setUpdateTitle] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [busy, onClose, open]);

  useEffect(() => {
    if (!open) return;
    setVersionTag("");
    setFile(null);
    setPostUpdate(true);
    setUpdateTitle("");
    setReleaseNotes("");
    setProgress(0);
    setError("");
    setComplete(false);
  }, [open]);

  const uploadEditorImage = async (image: File) => {
    const media = await uploadProductMedia(slug, image, "description");
    return media.media_url;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedVersion = versionTag.trim().replace(/^v/i, "");
    if (!normalizedVersion) {
      setError("Enter a new version number.");
      return;
    }
    if (!file) {
      setError("Attach the product file for this release.");
      return;
    }
    if (postUpdate && !updateTitle.trim()) {
      setError("Enter an update title or turn off Post an update.");
      return;
    }

    setBusy(true);
    setComplete(false);
    setProgress(1);
    setError("");
    try {
      await uploadProductVersion(
        slug,
        {
          version_tag: normalizedVersion,
          post_update: postUpdate,
          update_title: postUpdate ? updateTitle.trim() : "",
          changelog: postUpdate ? releaseNotes : "",
          file,
        },
        setProgress,
      );
      setProgress(100);
      setComplete(true);
      router.refresh();
      window.setTimeout(onClose, 450);
    } catch {
      setError("The release could not be uploaded. Check the file type and try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] overflow-y-auto bg-black/65 p-3 sm:p-5"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="mx-auto mt-[4vh] w-full max-w-[800px] overflow-hidden rounded-md border border-border bg-elevated text-textSecondary shadow-2xl shadow-black/60" role="dialog" aria-modal="true" aria-labelledby="update-resource-title">
        <header className="flex items-center justify-between border-b border-border bg-[var(--bg-panel)] px-4 py-3">
          <div className="min-w-0">
            <h2 id="update-resource-title" className="text-lg font-medium text-textPrimary sm:text-xl">Update resource</h2>
            <p className="truncate text-xs text-textSecondary">{productTitle}</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-textSecondary hover:bg-elevated hover:text-textPrimary disabled:opacity-40" aria-label="Close update dialog">
            <X className="size-5" />
          </button>
        </header>

        <form onSubmit={submit}>
          <section>
            <h3 className="border-b border-border bg-[var(--bg-panel)] px-4 py-2.5 text-sm font-semibold text-textPrimary">Release a new version</h3>
            <div className="space-y-5 px-4 py-5 sm:px-6">
              <label className="grid gap-2 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-start">
                <span className="pt-2 text-sm font-medium text-textPrimary">New version number <span className="text-danger">*</span></span>
                <span>
                  <input
                    autoFocus
                    required
                    maxLength={50}
                    value={versionTag}
                    onChange={(event) => setVersionTag(event.target.value)}
                    placeholder="1.1.0"
                    className="field-input h-11"
                  />
                  {currentVersion ? <span className="mt-1.5 block text-xs text-textSecondary">Current release: v{currentVersion}</span> : null}
                </span>
              </label>

              <div className="grid gap-2 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-start">
                <span className="pt-2 text-sm font-medium text-textPrimary">New content <span className="text-danger">*</span></span>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm text-textPrimary">
                    <input type="radio" checked readOnly className="size-4 accent-[var(--accent)]" /> Uploaded file
                  </label>
                  {file ? (
                    <div className="flex items-center gap-3 rounded-md border border-[#394355] bg-[var(--bg-panel)] p-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary"><FileArchive className="size-5" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-textPrimary">{file.name}</span>
                        <span className="block text-xs text-textSecondary">{formatBytes(file.size)}</span>
                      </span>
                      <button type="button" onClick={() => setFile(null)} disabled={busy} className="inline-flex size-8 items-center justify-center rounded-md text-textSecondary hover:bg-danger/10 hover:text-danger" aria-label="Remove file"><Trash2 className="size-4" /></button>
                    </div>
                  ) : (
                    <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-[#394355] bg-[var(--bg-panel)] px-4 py-4 text-center transition hover:border-primary/60">
                      <UploadCloud className="size-6 text-primary" />
                      <span className="text-sm font-medium text-textPrimary">Attach resource product file</span>
                      <span className="text-xs text-textSecondary">JAR, ZIP, RAR, 7Z, and other supported resource files</span>
                      <input type="file" required accept={artifactTypes} onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="sr-only" />
                    </label>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section>
            <h3 className="border-y border-border bg-[var(--bg-panel)] px-4 py-2.5 text-sm font-semibold text-textPrimary">Post an update</h3>
            <div className="space-y-5 px-4 py-5 sm:px-6">
              <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-textPrimary">
                <input type="checkbox" checked={postUpdate} onChange={(event) => setPostUpdate(event.target.checked)} className="size-4 rounded accent-[var(--accent)]" />
                Post an update with this release
              </label>

              {postUpdate ? (
                <>
                  <label className="grid gap-2 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
                    <span className="text-sm font-medium text-textPrimary">Update title</span>
                    <input required value={updateTitle} onChange={(event) => setUpdateTitle(event.target.value)} maxLength={100} placeholder="What is new in this release?" className="field-input h-11" />
                  </label>
                  <div className="grid gap-2 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-start">
                    <span className="pt-2 text-sm font-medium text-textPrimary">Update message</span>
                    <RichTextEditor value={releaseNotes} onChange={setReleaseNotes} onUploadImage={uploadEditorImage} placeholder="Explain what changed in this release..." minHeight={210} disabled={busy} />
                  </div>
                </>
              ) : null}
            </div>
          </section>

          {progress > 0 ? <div className="mx-4 h-1 overflow-hidden rounded-full bg-white/10 sm:mx-6"><div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div> : null}
          {error ? <p className="mx-4 mt-4 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger sm:mx-6">{error}</p> : null}
          {complete ? <p className="mx-4 mt-4 flex items-center gap-2 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm text-success sm:mx-6"><Check className="size-4" /> Release published.</p> : null}

          <footer className="mt-5 flex items-center justify-end gap-2 border-t border-border bg-[var(--bg-panel)] px-4 py-3">
            <button type="button" onClick={onClose} disabled={busy} className="inline-flex h-10 items-center justify-center rounded-md border border-border px-4 text-sm text-textPrimary hover:bg-elevated disabled:opacity-40">Cancel</button>
            <button type="submit" disabled={busy || complete} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-[var(--accent-hover)] disabled:opacity-50">
              {busy ? <Loader2 className="size-4 animate-spin" /> : complete ? <Check className="size-4" /> : <UploadCloud className="size-4" />}
              {busy ? "Uploading..." : complete ? "Published" : "Publish update"}
            </button>
          </footer>
        </form>
      </div>
    </div>,
    document.body,
  );
}
