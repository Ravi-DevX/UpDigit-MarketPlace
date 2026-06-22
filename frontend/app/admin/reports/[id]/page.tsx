"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { dismissAdminReport, fetchAdminReports, resolveAdminReport } from "@/lib/api";
import type { Report } from "@/types/marketplace";
import {
  actionButtonClass,
  EmptyState,
  ErrorState,
  formatDate,
  LoadingState,
  PageHeader,
  StatusBadge,
} from "@/app/admin/_components/AdminUI";

export default function AdminReportDetailPage({ params }: { params: { id: string } }) {
  const [report, setReport] = useState<Report | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setState("loading");
    try {
      const reports = await fetchAdminReports();
      setReport(reports.find((item) => item.id === params.id) ?? null);
      setState("ready");
    } catch {
      setState("error");
    }
  };

  useEffect(() => {
    void load();
  }, [params.id]);

  const run = async (action: () => Promise<void>) => {
    if (!report) {
      return;
    }
    setBusy(true);
    try {
      await action();
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Report detail"
        title={report?.reason || "Report"}
        description={`Report ID: ${params.id}`}
        action={
          <Link href="/admin/reports" className={actionButtonClass("neutral")}>
            <ArrowLeft className="size-4" />
            Back to reports
          </Link>
        }
      />

      {state === "error" ? <ErrorState message="Report detail could not load." /> : null}
      {state === "loading" ? <LoadingState label="Loading report detail..." /> : null}
      {state === "ready" && !report ? <EmptyState title="Report not found" description="This report was not returned by the admin reports API." /> : null}

      {state === "ready" && report ? (
        <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
          <article className="rounded-2xl border border-border bg-surface p-5">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <StatusBadge value={report.status} />
              <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-textSecondary">
                {report.target_type}
              </span>
            </div>
            <p className="text-sm leading-6 text-textSecondary">{report.details || "No extra details provided."}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button disabled={busy} type="button" onClick={() => run(() => resolveAdminReport(report.id))} className={actionButtonClass("primary")}>
                <CheckCircle2 className="size-4" />
                Resolve
              </button>
              <button disabled={busy} type="button" onClick={() => run(() => dismissAdminReport(report.id))} className={actionButtonClass("danger")}>
                <XCircle className="size-4" />
                Dismiss
              </button>
            </div>
          </article>

          <article className="rounded-2xl border border-border bg-surface p-5">
            <div className="grid gap-3 text-sm">
              {[
                ["Target ID", report.target_id],
                ["Reporter ID", report.reporter_id || "Anonymous"],
                ["Resolved By", report.resolved_by || "Not resolved"],
                ["Created", formatDate(report.created_at)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-border bg-elevated p-4">
                  <p className="text-textSecondary">{label}</p>
                  <p className="mt-1 break-all text-textPrimary">{value}</p>
                </div>
              ))}
            </div>
          </article>
        </div>
      ) : null}
    </section>
  );
}
