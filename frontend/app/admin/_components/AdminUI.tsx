"use client";

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function formatMoney(value?: number | null, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits,
  }).format(value || 0);
}

export function formatNumber(value?: number | null) {
  return new Intl.NumberFormat("en").format(value || 0);
}

export function formatDate(value?: string | null) {
  if (!value) {
    return "Unknown";
  }
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-primary">{eyebrow}</p>
        <h2 className="mt-2 text-2xl font-semibold text-textPrimary">{title}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-textSecondary">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function StatusBadge({ value }: { value?: string | boolean | null }) {
  const label = typeof value === "boolean" ? (value ? "Active" : "Inactive") : value || "Unknown";
  const normalized = String(label).toLowerCase();
  const tone =
    normalized.includes("approved") ||
    normalized.includes("active") ||
    normalized.includes("completed") ||
    normalized.includes("resolved")
      ? "border-success/30 bg-success/10 text-success"
      : normalized.includes("pending") || normalized.includes("open") || normalized.includes("review")
        ? "border-warning/30 bg-warning/10 text-warning"
        : normalized.includes("rejected") ||
            normalized.includes("banned") ||
            normalized.includes("refunded") ||
            normalized.includes("dismissed") ||
            normalized.includes("inactive")
          ? "border-danger/30 bg-danger/10 text-danger"
          : "border-border bg-surface text-textSecondary";

  return <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs capitalize", tone)}>{label}</span>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-8 text-center">
      <p className="text-sm font-medium text-textPrimary">{title}</p>
      <p className="mt-2 text-sm text-textSecondary">{description}</p>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">{message}</div>;
}

export function LoadingState({ label = "Loading admin data..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface p-8 text-sm text-textSecondary">
      <Loader2 className="size-4 animate-spin text-primary" />
      {label}
    </div>
  );
}

export function actionButtonClass(tone: "primary" | "danger" | "neutral" = "neutral") {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
    tone === "primary" && "bg-primary text-primary-foreground hover:bg-[var(--accent-hover)]",
    tone === "danger" && "border border-danger/30 bg-danger/10 text-danger hover:bg-danger/20",
    tone === "neutral" && "border border-border bg-elevated text-textSecondary hover:bg-elevated hover:text-textPrimary",
  );
}
