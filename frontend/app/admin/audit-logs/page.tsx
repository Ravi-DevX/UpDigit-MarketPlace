"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { fetchAdminAuditLogs } from "@/lib/api";
import type { AuditLog } from "@/types/marketplace";
import {
  EmptyState,
  ErrorState,
  formatDate,
  LoadingState,
  PageHeader,
  StatusBadge,
} from "@/app/admin/_components/AdminUI";

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [query, setQuery] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let mounted = true;
    fetchAdminAuditLogs()
      .then((items) => {
        if (mounted) {
          setLogs(items);
          setState("ready");
        }
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

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return logs;
    }
    return logs.filter((log) =>
      [log.id, log.action, log.target_type || "", log.target_id || "", log.ip_address || "", log.admin_id || ""].some((value) =>
        value.toLowerCase().includes(needle),
      ),
    );
  }, [logs, query]);

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Security"
        title="Audit logs"
        description="Track admin actions, moderation changes, finance decisions, and source IP metadata."
      />

      <label className="flex items-center gap-2 rounded-2xl border border-border bg-surface px-3 py-2 text-sm text-textSecondary">
        <Search className="size-4" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search action, target, admin, IP..."
          className="min-w-0 flex-1 bg-transparent text-textPrimary outline-none placeholder:text-textSecondary"
        />
      </label>

      {state === "error" ? <ErrorState message="Audit logs could not load." /> : null}
      {state === "loading" ? <LoadingState label="Loading audit logs..." /> : null}
      {state === "ready" && filtered.length === 0 ? <EmptyState title="No audit logs found" description="No matching admin actions are available." /> : null}

      {state === "ready" && filtered.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="grid grid-cols-[1fr_0.7fr_0.9fr_0.7fr_40px] gap-3 border-b border-border px-4 py-3 text-xs uppercase tracking-[0.12em] text-textSecondary max-lg:hidden">
            <span>Action</span>
            <span>Target</span>
            <span>Admin</span>
            <span>Created</span>
            <span />
          </div>
          <div className="divide-y divide-white/10">
            {filtered.map((log) => (
              <Link key={log.id} href={`/admin/audit-logs/${log.id}`} className="grid gap-3 px-4 py-4 transition hover:bg-surface lg:grid-cols-[1fr_0.7fr_0.9fr_0.7fr_40px] lg:items-center">
                <div>
                  <p className="font-mono text-sm text-textPrimary">{log.action}</p>
                  <p className="mt-1 text-xs text-textSecondary">{log.ip_address || "No IP recorded"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge value={log.target_type || "system"} />
                  <span className="break-all text-xs text-textSecondary">{log.target_id || "none"}</span>
                </div>
                <span className="break-all text-sm text-textSecondary">{log.admin_id || "system"}</span>
                <span className="text-sm text-textSecondary">{formatDate(log.created_at)}</span>
                <ArrowRight className="size-4 text-textSecondary" />
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
