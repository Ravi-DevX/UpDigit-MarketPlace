"use client";

import { FormEvent, useEffect, useState } from "react";
import { Link2, Loader2, Plus } from "lucide-react";
import { createSellerWebhook, fetchSellerWebhooks } from "@/lib/api";
import type { Webhook } from "@/types/marketplace";

const events = ["purchase", "review", "refund"];

export default function SellerWebhooksPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [url, setURL] = useState("");
  const [secret, setSecret] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>(["purchase"]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => setWebhooks(await fetchSellerWebhooks());

  useEffect(() => {
    load().catch(() => setError("Could not load webhooks."));
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await createSellerWebhook({ url, secret, events: selectedEvents });
      setURL("");
      setSecret("");
      setSelectedEvents(["purchase"]);
      await load();
    } catch {
      setError("Could not create webhook.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-primary">Automation</p>
        <h2 className="mt-2 text-2xl font-semibold text-textPrimary">Webhooks</h2>
        <p className="mt-2 text-sm text-textSecondary">Notify your external systems about purchases, reviews, and refunds.</p>
      </div>
      {error ? <div className="rounded-2xl border border-danger/50 bg-danger/10 p-3 text-sm text-danger">{error}</div> : null}
      <form onSubmit={submit} className="rounded-2xl border border-border bg-surface p-5">
        <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
          <input type="url" value={url} onChange={(event) => setURL(event.target.value)} placeholder="https://example.com/webhook" className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-primary/60" required />
          <input value={secret} onChange={(event) => setSecret(event.target.value)} placeholder="Signing secret" className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-primary/60" />
          <button disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm text-primary-foreground disabled:opacity-50">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Add
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {events.map((event) => (
            <label key={event} className="inline-flex items-center gap-2 rounded-full border border-border bg-elevated px-3 py-2 text-xs text-textSecondary">
              <input
                type="checkbox"
                checked={selectedEvents.includes(event)}
                onChange={(change) => {
                  setSelectedEvents((items) => change.target.checked ? [...items, event] : items.filter((item) => item !== event));
                }}
                className="accent-primary"
              />
              {event}
            </label>
          ))}
        </div>
      </form>
      <div className="space-y-3">
        {webhooks.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-textSecondary">No endpoints configured.</div>
        ) : (
          webhooks.map((webhook) => (
            <article key={webhook.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
              <span className="min-w-0">
                <span className="flex items-center gap-2 truncate text-sm font-medium text-textPrimary"><Link2 className="size-4 text-primary" />{webhook.url}</span>
                <span className="mt-1 block text-xs text-textSecondary">{webhook.events.join(", ")}</span>
              </span>
              <span className="w-fit rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-textSecondary">{webhook.is_active ? "Active" : "Disabled"}</span>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
