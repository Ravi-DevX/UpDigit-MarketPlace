"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Search, XCircle } from "lucide-react";
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

export default function AdminReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [query, setQuery] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setState("loading");
    try {
      setReports(await fetchAdminReports());
      setState("ready");
    } catch {
      setState("error");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return reports;
    }
    return reports.filter((report) =>
      [report.id, report.target_type, report.target_id, report.reason, report.status].some((value) => value.toLowerCase().includes(needle)),
    );
  }, [reports, query]);

  const run = async (id: string, action: () => Promise<void>) => {
    setBusyId(id);
    try {
      await action();
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Trust and safety"
        title="Reports"
        description="Review abuse, compliance, and marketplace safety reports. Resolve valid reports or dismiss invalid ones."
      />

      <label className="flex items-center gap-2 rounded-2xl border border-border bg-surface px-3 py-2 text-sm text-textSecondary">
        <Search className="size-4" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search report, target, reason, status..."
          className="min-w-0 flex-1 bg-transparent text-textPrimary outline-none placeholder:text-textSecondary"
        />
      </label>

      {state === "error" ? <ErrorState message="Reports could not load." /> : null}
      {state === "loading" ? <LoadingState label="Loading reports..." /> : null}
      {state === "ready" && filtered.length === 0 ? <EmptyState title="No reports found" description="There are no reports matching the current filter." /> : null}

      {state === "ready" && filtered.length > 0 ? (
        <div className="grid gap-4">
          {filtered.map((report) => (
            <article key={report.id} className="rounded-2xl border border-border bg-surface p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-textPrimary">{report.reason}</h3>
                    <StatusBadge value={report.status} />
                    <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-textSecondary">
                      {report.target_type}
                    </span>
                  </div>
                  <p className="truncate text-xs text-textSecondary">
                    target {report.target_id} · reporter {report.reporter_id || "anonymous"}
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-textSecondary">{report.details || "No extra report details."}</p>
                  <p className="mt-2 text-xs text-textSecondary">Created {formatDate(report.created_at)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busyId === report.id || report.status === "resolved"}
                    onClick={() => run(report.id, () => resolveAdminReport(report.id))}
                    className={actionButtonClass("primary")}
                  >
                    <CheckCircle2 className="size-4" />
                    Resolve
                  </button>
                  <button
                    type="button"
                    disabled={busyId === report.id || report.status === "dismissed"}
                    onClick={() => run(report.id, () => dismissAdminReport(report.id))}
                    className={actionButtonClass("danger")}
                  >
                    <XCircle className="size-4" />
                    Dismiss
                  </button>
                  <Link href={`/admin/reports/${report.id}`} className={actionButtonClass("neutral")}>
                    Detail
                    <ArrowRight className="size-4" />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
