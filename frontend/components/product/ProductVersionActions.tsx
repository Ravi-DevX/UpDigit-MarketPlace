"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Download, Loader2, Trash2, X } from "lucide-react";
import { deleteProductVersion, downloadProductVersion } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

export function ProductVersionActions({ slug, versionId, sellerId, isLatest }: { slug: string; versionId: string; sellerId: string; isLatest: boolean }) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const hasCheckedSession = useAuthStore((state) => state.hasCheckedSession);
  const [confirming, setConfirming] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState<"download" | "delete" | "">("");
  const [error, setError] = useState("");

  useEffect(() => setMounted(true), []);

  if (!hasCheckedSession || user?.id !== sellerId) return null;

  const download = async () => {
    setBusy("download");
    setError("");
    try {
      const payload = await downloadProductVersion(slug, versionId);
      const url = URL.createObjectURL(payload.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = payload.fileName;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Could not download this release.");
    } finally {
      setBusy("");
    }
  };

  const remove = async () => {
    setBusy("delete");
    setError("");
    try {
      await deleteProductVersion(slug, versionId);
      setConfirming(false);
      router.refresh();
    } catch {
      setError("Could not delete this release file.");
    } finally {
      setBusy("");
    }
  };

  return (
    <>
      <div className="flex items-center justify-end gap-1">
        <button type="button" onClick={() => void download()} disabled={Boolean(busy)} className="inline-flex size-8 items-center justify-center rounded-md text-textSecondary hover:bg-elevated hover:text-textPrimary disabled:opacity-40" title="Download this version" aria-label="Download this version">
          {busy === "download" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
        </button>
        {!isLatest ? (
          <button type="button" onClick={() => setConfirming(true)} disabled={Boolean(busy)} className="inline-flex size-8 items-center justify-center rounded-md text-textSecondary hover:bg-danger/10 hover:text-danger disabled:opacity-40" title="Delete this version" aria-label="Delete this version">
            <Trash2 className="size-4" />
          </button>
        ) : null}
      </div>
      {error ? <p className="mt-1 text-right text-xs text-danger">{error}</p> : null}
      {mounted && confirming
        ? createPortal(
            <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/65 p-4" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setConfirming(false)}>
              <section className="w-full max-w-md overflow-hidden rounded-md border border-[#394355] bg-elevated shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="delete-version-title">
                <header className="flex items-center justify-between border-b border-border bg-[var(--bg-panel)] px-4 py-3">
                  <h2 id="delete-version-title" className="font-semibold text-textPrimary">Delete release file?</h2>
                  <button type="button" onClick={() => setConfirming(false)} disabled={busy === "delete"} className="inline-flex size-8 items-center justify-center rounded-md text-textSecondary hover:bg-elevated hover:text-textPrimary"><X className="size-4" /></button>
                </header>
                <div className="p-4">
                  <p className="text-sm leading-6 text-textSecondary">This permanently deletes the historical artifact from storage. This action cannot be undone.</p>
                  {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
                  <div className="mt-5 flex justify-end gap-2">
                    <button type="button" onClick={() => setConfirming(false)} disabled={busy === "delete"} className="h-10 rounded-md border border-border px-4 text-sm text-textPrimary">Cancel</button>
                    <button type="button" onClick={() => void remove()} disabled={busy === "delete"} className="inline-flex h-10 items-center gap-2 rounded-md bg-danger px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">
                      {busy === "delete" ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} Delete version
                    </button>
                  </div>
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
