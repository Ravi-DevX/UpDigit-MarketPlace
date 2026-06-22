"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CircleHelp, X } from "lucide-react";

export function InfoHelpButton({ title, description }: { title: string; description: string }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex size-5 shrink-0 items-center justify-center rounded text-textSecondary transition hover:bg-elevated hover:text-primary"
        aria-label={`More information about ${title}`}
        title={`More information about ${title}`}
      >
        <CircleHelp className="size-3.5" />
      </button>
      {mounted && open
        ? createPortal(
            <div
              className="fixed inset-0 z-[130] flex items-center justify-center bg-black/65 p-4"
              role="presentation"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setOpen(false);
              }}
            >
              <section className="w-full max-w-lg overflow-hidden rounded-md border border-[#394355] bg-elevated shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="sidebar-help-title">
                <header className="flex items-center justify-between border-b border-border bg-[var(--bg-panel)] px-4 py-3">
                  <h2 id="sidebar-help-title" className="font-semibold text-textPrimary">{title}</h2>
                  <button type="button" onClick={() => setOpen(false)} className="inline-flex size-8 items-center justify-center rounded-md text-textSecondary hover:bg-elevated hover:text-textPrimary" aria-label="Close information dialog">
                    <X className="size-4" />
                  </button>
                </header>
                <p className="px-4 py-5 text-sm leading-6 text-textSecondary">{description}</p>
              </section>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
