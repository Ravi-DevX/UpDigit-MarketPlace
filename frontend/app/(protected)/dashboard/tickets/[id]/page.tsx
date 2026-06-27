"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Loader2, Send } from "lucide-react";
import { fetchTicket, replyTicket, updateTicketStatus } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import type { SupportTicket, SupportTicketMessage } from "@/types/marketplace";
import { UserAvatar } from "@/components/common/UserAvatar";

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function canReply(ticket: SupportTicket) {
  return !ticket.is_locked && !ticket.status?.is_closed;
}

export default function TicketDetailPage({ params }: { params: { id: string } }) {
  const user = useAuthStore((state) => state.user);
  const isStaff = user?.role === "admin" || user?.role === "staff";
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportTicketMessage[]>([]);
  const [body, setBody] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = () => {
    setState("loading");
    fetchTicket(params.id)
      .then((payload) => {
        setTicket(payload.ticket);
        setMessages(payload.messages);
        setState("ready");
      })
      .catch(() => setState("error"));
  };

  useEffect(() => {
    load();
  }, [params.id]);

  const participants = useMemo(() => ticket?.participants?.filter((participant) => !participant.left_at) ?? [], [ticket]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const text = body.trim();
    if (!text) return;
    setBusy("reply");
    setError("");
    try {
      const message = await replyTicket(params.id, text);
      setMessages((current) => [...current, message]);
      setBody("");
      const payload = await fetchTicket(params.id);
      setTicket(payload.ticket);
    } catch {
      setError("Reply could not be sent.");
    } finally {
      setBusy("");
    }
  };

  const changeStatus = async (status: string) => {
    setBusy(status);
    setError("");
    try {
      const updated = await updateTicketStatus(params.id, status);
      setTicket(updated);
    } catch {
      setError("Status could not be updated.");
    } finally {
      setBusy("");
    }
  };

  if (state === "loading") {
    return <div className="rounded-2xl border border-border bg-elevated p-5 text-sm text-textSecondary">Loading ticket...</div>;
  }

  if (state === "error" || !ticket) {
    return (
      <section className="space-y-4">
        <Link href="/dashboard/tickets" className="inline-flex items-center gap-2 text-sm text-primary">
          <ArrowLeft className="size-4" />
          Back to tickets
        </Link>
        <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">Ticket could not load.</div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/dashboard/tickets" className="inline-flex items-center gap-2 text-sm text-primary">
            <ArrowLeft className="size-4" />
            Tickets
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border bg-elevated px-2 py-1 text-xs text-textSecondary">#{ticket.ticket_ref}</span>
            <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-xs text-primary">{ticket.status?.name || "Open"}</span>
          </div>
          <h1 className="mt-3 text-2xl font-semibold text-textPrimary">{ticket.title}</h1>
          <p className="mt-2 text-sm text-textSecondary">
            {ticket.category?.name || "Support"} · {ticket.priority?.name || "Normal"} · Last activity {dateLabel(ticket.last_message_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isStaff ? (
            <>
              <button type="button" onClick={() => changeStatus("waiting_on_customer")} disabled={!!busy} className="rounded-full border border-border px-3 py-2 text-xs text-textSecondary hover:text-textPrimary disabled:opacity-60">Waiting on customer</button>
              <button type="button" onClick={() => changeStatus("waiting_on_staff")} disabled={!!busy} className="rounded-full border border-border px-3 py-2 text-xs text-textSecondary hover:text-textPrimary disabled:opacity-60">Waiting on staff</button>
            </>
          ) : null}
          {ticket.status?.is_closed ? (
            <button type="button" onClick={() => changeStatus("open")} disabled={!!busy} className="inline-flex items-center gap-2 rounded-full border border-primary/40 px-3 py-2 text-xs text-primary disabled:opacity-60">
              {busy === "open" ? <Loader2 className="size-3 animate-spin" /> : null}
              Reopen
            </button>
          ) : (
            <button type="button" onClick={() => changeStatus("resolved")} disabled={!!busy} className="inline-flex items-center gap-2 rounded-full bg-success px-3 py-2 text-xs font-medium text-white disabled:opacity-60">
              {busy === "resolved" ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />}
              Resolve
            </button>
          )}
        </div>
      </div>

      <aside className="rounded-2xl border border-border bg-elevated p-4">
        <p className="text-xs uppercase tracking-[0.16em] text-textSecondary">Participants</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {participants.map((participant) => (
            <span key={participant.user_id} className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-textSecondary">
              <UserAvatar username={participant.username} displayName={participant.display_name} avatarURL={participant.avatar_url} className="size-5 text-[10px]" />
              {participant.display_name || participant.username}
              <span className="text-[10px] uppercase text-textSecondary">{participant.role}</span>
            </span>
          ))}
        </div>
      </aside>

      <div className="space-y-3">
        {messages.map((message) => {
          const mine = message.user_id === user?.id;
          return (
            <article key={message.id} className={`flex gap-3 ${mine ? "justify-end" : "justify-start"}`}>
              {!mine ? (
                <UserAvatar username={message.username ?? undefined} displayName={message.display_name} avatarURL={message.avatar_url} className="mt-1 size-9 text-xs" />
              ) : null}
              <div className={`max-w-2xl rounded-2xl border border-border p-4 ${mine ? "bg-primary/10" : "bg-elevated"}`}>
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-textSecondary">
                  <span className="font-medium text-textPrimary">{message.display_name || message.username || "System"}</span>
                  <span>{dateLabel(message.created_at)}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-6 text-textPrimary">{message.body}</p>
              </div>
            </article>
          );
        })}
      </div>

      {error ? <div className="rounded-2xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{error}</div> : null}

      {canReply(ticket) ? (
        <form onSubmit={submit} className="rounded-2xl border border-border bg-elevated p-4">
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={4}
            maxLength={20000}
            className="w-full resize-y rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary/60"
            placeholder="Write a reply..."
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-xs text-textSecondary">{body.trim().length}/20000</span>
            <button type="submit" disabled={busy === "reply" || !body.trim()} className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
              {busy === "reply" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Reply
            </button>
          </div>
        </form>
      ) : (
        <div className="rounded-2xl border border-border bg-elevated p-4 text-sm text-textSecondary">This ticket is closed or locked.</div>
      )}
    </section>
  );
}
