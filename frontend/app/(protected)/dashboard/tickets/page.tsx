"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Inbox, LifeBuoy, Loader2, Plus, ShieldCheck } from "lucide-react";
import { createTicket, fetchTicketMeta, fetchTickets } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import type { SupportTicket, SupportTicketCategory, SupportTicketPriority } from "@/types/marketplace";

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusClass(slug?: string) {
  if (slug === "resolved" || slug === "closed") return "border-success/30 bg-success/10 text-success";
  if (slug === "waiting_on_customer") return "border-warning/30 bg-warning/10 text-warning";
  return "border-primary/30 bg-primary/10 text-primary";
}

export default function TicketsPage() {
  const user = useAuthStore((state) => state.user);
  const isStaff = user?.role === "admin" || user?.role === "staff";
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [categories, setCategories] = useState<SupportTicketCategory[]>([]);
  const [priorities, setPriorities] = useState<SupportTicketPriority[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [categoryID, setCategoryID] = useState("");
  const [priorityID, setPriorityID] = useState("");
  const [error, setError] = useState("");

  const load = () => {
    setState("loading");
    Promise.all([
      fetchTickets(isStaff ? { scope: "all" } : {}),
      fetchTicketMeta(),
    ])
      .then(([items, meta]) => {
        setTickets(items);
        setCategories(meta.categories);
        setPriorities(meta.priorities);
        setCategoryID((current) => current || meta.categories[0]?.id || "");
        setPriorityID((current) => current || meta.priorities.find((priority) => priority.slug === "normal")?.id || meta.priorities[0]?.id || "");
        setState("ready");
      })
      .catch(() => setState("error"));
  };

  useEffect(() => {
    load();
  }, [isStaff]);

  const unreadCount = useMemo(() => tickets.filter((ticket) => ticket.is_unread).length, [tickets]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const cleanTitle = title.trim();
    const cleanBody = body.trim();
    if (cleanTitle.length < 5 || cleanBody.length < 10) {
      setError("Use a clear title and at least 10 characters for the message.");
      return;
    }
    setCreating(true);
    setError("");
    try {
      const ticket = await createTicket({
        title: cleanTitle,
        body: cleanBody,
        category_id: categoryID || null,
        priority_id: priorityID || null,
      });
      setTickets((current) => [ticket, ...current]);
      setTitle("");
      setBody("");
      setShowForm(false);
    } catch {
      setError("Ticket could not be created.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-primary">Support desk</p>
          <h1 className="mt-2 text-2xl font-semibold text-textPrimary">Tickets</h1>
          <p className="mt-2 text-sm text-textSecondary">
            Threaded product, order, and account support. {unreadCount ? `${unreadCount} unread.` : "No unread tickets."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((value) => !value)}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          <Plus className="size-4" />
          New ticket
        </button>
      </div>

      {isStaff ? (
        <div className="flex items-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
          <ShieldCheck className="size-4" />
          Staff scope is enabled, so this list includes all visible marketplace tickets.
        </div>
      ) : null}

      {showForm ? (
        <form onSubmit={submit} className="rounded-2xl border border-border bg-elevated p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="text-textSecondary">Category</span>
              <select value={categoryID} onChange={(event) => setCategoryID(event.target.value)} className="rounded-xl border border-border bg-background px-3 py-2 outline-none focus:border-primary/60">
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-textSecondary">Priority</span>
              <select value={priorityID} onChange={(event) => setPriorityID(event.target.value)} className="rounded-xl border border-border bg-background px-3 py-2 outline-none focus:border-primary/60">
                {priorities.map((priority) => (
                  <option key={priority.id} value={priority.id}>{priority.name}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="mt-3 grid gap-1 text-sm">
            <span className="text-textSecondary">Title</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={220} className="rounded-xl border border-border bg-background px-3 py-2 outline-none focus:border-primary/60" />
          </label>
          <label className="mt-3 grid gap-1 text-sm">
            <span className="text-textSecondary">Message</span>
            <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={5} maxLength={20000} className="resize-y rounded-xl border border-border bg-background px-3 py-2 outline-none focus:border-primary/60" />
          </label>
          {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
          <div className="mt-4 flex justify-end">
            <button type="submit" disabled={creating} className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
              {creating ? <Loader2 className="size-4 animate-spin" /> : <LifeBuoy className="size-4" />}
              Open ticket
            </button>
          </div>
        </form>
      ) : null}

      {state === "error" ? (
        <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">Tickets could not load.</div>
      ) : null}

      <div className="rounded-2xl border border-border bg-surface">
        {state === "loading" ? (
          <div className="flex items-center gap-3 p-5 text-sm text-textSecondary">
            <LifeBuoy className="size-4 text-primary" />
            Loading tickets...
          </div>
        ) : tickets.length === 0 ? (
          <div className="flex items-center gap-3 p-5 text-sm text-textSecondary">
            <Inbox className="size-4 text-primary" />
            No tickets yet.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {tickets.map((ticket) => (
              <Link key={ticket.id} href={`/dashboard/tickets/${ticket.id}`} className="grid gap-3 p-4 transition hover:bg-elevated sm:grid-cols-[1fr_auto] sm:items-center">
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    {ticket.is_unread ? <span className="size-2 rounded-full bg-primary" /> : null}
                    <span className="text-xs text-textSecondary">#{ticket.ticket_ref}</span>
                    <span className="truncate text-sm font-semibold text-textPrimary">{ticket.title}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] ${statusClass(ticket.status?.slug)}`}>{ticket.status?.name || "Open"}</span>
                  </span>
                  <span className="mt-2 block truncate text-sm text-textSecondary">{ticket.last_message?.body || "No messages yet."}</span>
                  <span className="mt-2 block text-xs text-textSecondary">
                    {ticket.category?.name || "Support"} · {ticket.priority?.name || "Normal"} · {ticket.reply_count} replies
                  </span>
                </span>
                <span className="flex items-center justify-between gap-3 text-xs text-textSecondary sm:justify-end">
                  <span>{dateLabel(ticket.last_message_at)}</span>
                  <ArrowRight className="size-4" />
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
