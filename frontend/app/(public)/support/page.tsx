"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Inbox, LifeBuoy, Loader2, Plus, Rocket } from "lucide-react";
import { createTicket, fetchTicketMeta, fetchTickets, requestDgenLogin } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import type { SupportTicket, SupportTicketCategory, SupportTicketPriority } from "@/types/marketplace";

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export default function SupportPage() {
  const isAuth = useAuthStore((state) => state.isAuthenticated);
  const hasCheckedSession = useAuthStore((state) => state.hasCheckedSession);
  const user = useAuthStore((state) => state.user);
  const isStaff = user?.role === "admin" || user?.role === "staff";
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [categories, setCategories] = useState<SupportTicketCategory[]>([]);
  const [priorities, setPriorities] = useState<SupportTicketPriority[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [categoryID, setCategoryID] = useState("");
  const [priorityID, setPriorityID] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    if (!isAuth) return;
    setState("loading");
    Promise.all([fetchTickets(isStaff ? { scope: "all" } : {}), fetchTicketMeta()])
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
    if (hasCheckedSession && isAuth) {
      load();
    }
  }, [hasCheckedSession, isAuth, isStaff]);

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
      const ticket = await createTicket({ title: cleanTitle, body: cleanBody, category_id: categoryID || null, priority_id: priorityID || null });
      setTickets((current) => [ticket, ...current]);
      setTitle("");
      setBody("");
      setFormOpen(false);
    } catch {
      setError("Ticket could not be created.");
    } finally {
      setCreating(false);
    }
  };

  if (!hasCheckedSession) {
    return <div className="rounded-panel border border-border bg-surface p-6 text-sm text-textSecondary">Checking session...</div>;
  }

  if (!isAuth) {
    return (
      <section className="mx-auto max-w-2xl rounded-panel border border-border bg-surface p-6 text-center shadow-[0_24px_90px_rgba(0,0,0,0.28)]">
        <LifeBuoy className="mx-auto size-9 text-primary" />
        <h1 className="mt-4 text-2xl font-semibold text-textPrimary">Support Desk</h1>
        <p className="mt-2 text-sm text-textSecondary">Sign in to open or review support tickets.</p>
        <button type="button" onClick={() => requestDgenLogin("/support")} className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">
          <Rocket className="size-4" />
          Sign in
        </button>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-primary">Support Desk</p>
          <h1 className="mt-2 text-3xl font-semibold text-textPrimary">Tickets</h1>
          <p className="mt-2 text-sm text-textSecondary">Open product, purchase, account, and seller support threads.</p>
        </div>
        <button type="button" onClick={() => setFormOpen((open) => !open)} className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          <Plus className="size-4" />
          New ticket
        </button>
      </div>

      {formOpen ? (
        <form onSubmit={submit} className="rounded-2xl border border-border bg-elevated p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <select value={categoryID} onChange={(event) => setCategoryID(event.target.value)} className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/60">
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
            <select value={priorityID} onChange={(event) => setPriorityID(event.target.value)} className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/60">
              {priorities.map((priority) => <option key={priority.id} value={priority.id}>{priority.name}</option>)}
            </select>
          </div>
          <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={220} className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/60" placeholder="Ticket title" />
          <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={5} maxLength={20000} className="mt-3 w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/60" placeholder="Message" />
          {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
          <div className="mt-4 flex justify-end">
            <button type="submit" disabled={creating} className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
              {creating ? <Loader2 className="size-4 animate-spin" /> : <LifeBuoy className="size-4" />}
              Open ticket
            </button>
          </div>
        </form>
      ) : null}

      <div className="rounded-2xl border border-border bg-surface">
        {state === "loading" ? (
          <div className="flex items-center gap-3 p-5 text-sm text-textSecondary"><LifeBuoy className="size-4 text-primary" />Loading tickets...</div>
        ) : state === "error" ? (
          <div className="p-5 text-sm text-warning">Tickets could not load.</div>
        ) : tickets.length === 0 ? (
          <div className="flex items-center gap-3 p-5 text-sm text-textSecondary"><Inbox className="size-4 text-primary" />No tickets yet.</div>
        ) : (
          <div className="divide-y divide-border">
            {tickets.map((ticket) => (
              <Link key={ticket.id} href={`/dashboard/tickets/${ticket.id}`} className="grid gap-3 p-4 transition hover:bg-elevated sm:grid-cols-[1fr_auto] sm:items-center">
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    {ticket.is_unread ? <span className="size-2 rounded-full bg-primary" /> : null}
                    <span className="text-xs text-textSecondary">#{ticket.ticket_ref}</span>
                    <span className="truncate text-sm font-semibold text-textPrimary">{ticket.title}</span>
                    <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] text-primary">{ticket.status?.name || "Open"}</span>
                  </span>
                  <span className="mt-2 block truncate text-sm text-textSecondary">{ticket.last_message?.body || "No messages yet."}</span>
                </span>
                <span className="flex items-center gap-3 text-xs text-textSecondary">
                  {dateLabel(ticket.last_message_at)}
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
