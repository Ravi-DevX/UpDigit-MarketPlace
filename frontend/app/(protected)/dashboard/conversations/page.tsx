"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Inbox, MessageSquare } from "lucide-react";
import { fetchConversations } from "@/lib/api";
import type { Conversation } from "@/types/marketplace";

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let mounted = true;
    fetchConversations()
      .then((items) => {
        if (!mounted) {
          return;
        }
        setConversations(items);
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
  }, []);

  const unreadCount = useMemo(() => conversations.filter((conversation) => conversation.is_unread).length, [conversations]);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-primary">Inbox</p>
          <h1 className="mt-2 text-2xl font-semibold text-textPrimary">Conversations</h1>
          <p className="mt-2 text-sm text-textSecondary">
            Private buyer, seller, and marketplace messages. {unreadCount ? `${unreadCount} unread.` : "No unread conversations."}
          </p>
        </div>
      </div>

      {state === "error" ? (
        <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
          Conversations could not load.
        </div>
      ) : null}

      <div className="rounded-2xl border border-border bg-surface">
        {state === "loading" ? (
          <div className="flex items-center gap-3 p-5 text-sm text-textSecondary">
            <MessageSquare className="size-4 text-primary" />
            Loading conversations...
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex items-center gap-3 p-5 text-sm text-textSecondary">
            <Inbox className="size-4 text-primary" />
            Your inbox is empty.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {conversations.map((conversation) => {
              const last = conversation.last_message;
              return (
                <Link
                  key={conversation.id}
                  href={`/dashboard/conversations/${conversation.id}`}
                  className="grid gap-3 p-4 transition hover:bg-elevated sm:grid-cols-[1fr_auto] sm:items-center"
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      {conversation.is_unread ? <span className="size-2 rounded-full bg-primary" /> : null}
                      <span className="truncate text-sm font-semibold text-textPrimary">{conversation.title}</span>
                    </span>
                    <span className="mt-1 block truncate text-sm text-textSecondary">
                      {last?.body || "No messages yet."}
                    </span>
                    <span className="mt-2 block text-xs text-textSecondary">
                      {conversation.participant_count} participants · {conversation.message_count} messages · {conversation.is_open ? "Open" : "Closed"}
                    </span>
                  </span>
                  <span className="flex items-center justify-between gap-3 text-xs text-textSecondary sm:justify-end">
                    <span>{dateLabel(conversation.last_message_at)}</span>
                    <ArrowRight className="size-4" />
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
