"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { fetchAdminAuditLogs } from "@/lib/api";
import type { AuditLog } from "@/types/marketplace";
import {
  actionButtonClass,
  EmptyState,
  ErrorState,
  formatDate,
  LoadingState,
  PageHeader,
  StatusBadge,
} from "@/app/admin/_components/AdminUI";

export default function AdminAuditDetailPage({ params }: { params: { id: string } }) {
  const [log, setLog] = useState<AuditLog | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let mounted = true;
    fetchAdminAuditLogs()
      .then((logs) => {
        if (mounted) {
          setLog(logs.find((item) => item.id === params.id) ?? null);
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
  }, [params.id]);

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Audit entry"
        title={log?.action || "Audit log"}
        description={`Log ID: ${params.id}`}
        action={
          <Link href="/admin/audit-logs" className={actionButtonClass("neutral")}>
            <ArrowLeft className="size-4" />
            Back to logs
          </Link>
        }
      />

      {state === "error" ? <ErrorState message="Audit entry could not load." /> : null}
      {state === "loading" ? <LoadingState label="Loading audit entry..." /> : null}
      {state === "ready" && !log ? <EmptyState title="Audit entry not found" description="This log was not returned by the audit API." /> : null}

      {state === "ready" && log ? (
        <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <article className="rounded-2xl border border-border bg-surface p-5">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <StatusBadge value={log.target_type || "system"} />
              <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-textSecondary">
                {formatDate(log.created_at)}
              </span>
            </div>
            <div className="grid gap-3 text-sm">
              {[
                ["Admin ID", log.admin_id || "system"],
                ["Target ID", log.target_id || "none"],
                ["IP Address", log.ip_address || "not recorded"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-border bg-elevated p-4">
                  <p className="text-textSecondary">{label}</p>
                  <p className="mt-1 break-all text-textPrimary">{value}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-border bg-surface p-5">
            <p className="mb-3 text-sm font-medium text-textPrimary">Details</p>
            <pre className="max-h-[520px] overflow-auto rounded-2xl border border-border bg-black/40 p-4 text-xs leading-5 text-textSecondary">
              {JSON.stringify(log.details || {}, null, 2)}
            </pre>
          </article>
        </div>
      ) : null}
    </section>
  );
}
