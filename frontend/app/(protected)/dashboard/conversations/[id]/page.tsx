"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import { fetchConversation, replyConversation } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import type { Conversation, ConversationMessage } from "@/types/marketplace";
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

export default function ConversationDetailPage({ params }: { params: { id: string } }) {
  const user = useAuthStore((state) => state.user);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [body, setBody] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    fetchConversation(params.id)
      .then((payload) => {
        if (!mounted) {
          return;
        }
        setConversation(payload.conversation);
        setMessages(payload.messages);
        setState("ready");
      })
      .catch(() => {
        if (mounted) {
          setState("error");
        }
      });
    return () => {
      mounted = false;
    };
  }, [params.id]);

  const participants = useMemo(() => conversation?.participants?.filter((participant) => !participant.left_at) ?? [], [conversation]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const text = body.trim();
    if (!text) {
      return;
    }
    setSending(true);
    setError("");
    try {
      const message = await replyConversation(params.id, text);
      setMessages((current) => [...current, message]);
      setBody("");
    } catch {
      setError("Reply could not be sent.");
    } finally {
      setSending(false);
    }
  };

  if (state === "loading") {
    return <div className="rounded-2xl border border-border bg-elevated p-5 text-sm text-textSecondary">Loading conversation...</div>;
  }

  if (state === "error" || !conversation) {
    return (
      <section className="space-y-4">
        <Link href="/dashboard/conversations" className="inline-flex items-center gap-2 text-sm text-primary">
          <ArrowLeft className="size-4" />
          Back to conversations
        </Link>
        <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">Conversation could not load.</div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/dashboard/conversations" className="inline-flex items-center gap-2 text-sm text-primary">
            <ArrowLeft className="size-4" />
            Conversations
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-textPrimary">{conversation.title}</h1>
          <p className="mt-2 text-sm text-textSecondary">
            {participants.length} participants · {conversation.is_open ? "Open" : "Closed"} · Last activity {dateLabel(conversation.last_message_at)}
          </p>
        </div>
      </div>

      <aside className="rounded-2xl border border-border bg-elevated p-4">
        <p className="text-xs uppercase tracking-[0.16em] text-textSecondary">Participants</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {participants.map((participant) => (
            <span key={participant.user_id} className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-textSecondary">
              <UserAvatar username={participant.username} displayName={participant.display_name} avatarURL={participant.avatar_url} className="size-5 text-[10px]" />
              {participant.display_name || participant.username}
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

      {conversation.is_open ? (
        <form onSubmit={submit} className="rounded-2xl border border-border bg-elevated p-4">
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={4}
            maxLength={10000}
            className="w-full resize-y rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary/60"
            placeholder="Write a reply..."
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-xs text-textSecondary">{body.trim().length}/10000</span>
            <button
              type="submit"
              disabled={sending || !body.trim()}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Reply
            </button>
          </div>
        </form>
      ) : (
        <div className="rounded-2xl border border-border bg-elevated p-4 text-sm text-textSecondary">This conversation is closed.</div>
      )}
    </section>
  );
}
