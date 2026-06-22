"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Check, CheckCheck, Loader2 } from "lucide-react";
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/api";
import type { MarketplaceNotification } from "@/types/marketplace";

function formatNotificationDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function notifyNavbar() {
  window.dispatchEvent(new Event("updigit:notifications-changed"));
}

export default function NotificationsPage() {
  const [items, setItems] = useState<MarketplaceNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    void fetchNotifications()
      .then((notifications) => {
        if (mounted) setItems(notifications);
      })
      .catch(() => {
        if (mounted) setError("Could not load notifications.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const markRead = async (id: string) => {
    setBusy(id);
    setError("");
    try {
      await markNotificationRead(id);
      setItems((current) => current.map((item) => item.id === id ? { ...item, is_read: true } : item));
      notifyNavbar();
    } catch {
      setError("Could not update that notification.");
    } finally {
      setBusy("");
    }
  };

  const markAll = async () => {
    setBusy("all");
    setError("");
    try {
      await markAllNotificationsRead();
      setItems((current) => current.map((item) => ({ ...item, is_read: true })));
      notifyNavbar();
    } catch {
      setError("Could not mark notifications as read.");
    } finally {
      setBusy("");
    }
  };

  const unread = items.filter((item) => !item.is_read).length;

  return (
    <section className="space-y-5">
      <header className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-primary">Inbox</p>
          <h1 className="mt-2 text-2xl font-semibold text-textPrimary">Notifications</h1>
          <p className="mt-2 text-sm text-textSecondary">Product moderation, purchases, refunds, and account updates.</p>
        </div>
        {unread > 0 ? (
          <button type="button" onClick={() => void markAll()} disabled={Boolean(busy)} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border px-4 text-sm text-textPrimary hover:border-primary/40 disabled:opacity-50">
            {busy === "all" ? <Loader2 className="size-4 animate-spin" /> : <CheckCheck className="size-4" />} Mark all read
          </button>
        ) : null}
      </header>

      {error ? <p className="rounded-md border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : null}
      {loading ? (
        <div className="flex min-h-40 items-center justify-center text-textSecondary"><Loader2 className="size-5 animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="flex min-h-48 flex-col items-center justify-center rounded-md border border-border bg-surface p-6 text-center">
          <Bell className="size-7 text-textSecondary" />
          <p className="mt-3 font-medium text-textPrimary">Your inbox is empty</p>
          <p className="mt-1 text-sm text-textSecondary">New marketplace activity will appear here.</p>
        </div>
      ) : (
        <div className="divide-y divide-white/10 overflow-hidden rounded-md border border-border">
          {items.map((item) => (
            <article key={item.id} className={`flex gap-4 p-4 ${item.is_read ? "bg-transparent" : "bg-primary/[0.07]"}`}>
              <span className={`mt-1 size-2 shrink-0 rounded-full ${item.is_read ? "bg-white/15" : "bg-primary"}`} />
              <div className="min-w-0 flex-1">
                {item.link ? <Link href={item.link} className="font-medium text-textPrimary hover:text-primary">{item.title}</Link> : <h2 className="font-medium text-textPrimary">{item.title}</h2>}
                {item.body ? <p className="mt-1 text-sm leading-6 text-textSecondary">{item.body}</p> : null}
                <p className="mt-2 text-xs text-textSecondary">{formatNotificationDate(item.created_at)}</p>
              </div>
              {!item.is_read ? (
                <button type="button" onClick={() => void markRead(item.id)} disabled={Boolean(busy)} title="Mark as read" aria-label="Mark as read" className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-textSecondary hover:bg-elevated hover:text-textPrimary disabled:opacity-50">
                  {busy === item.id ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                </button>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
