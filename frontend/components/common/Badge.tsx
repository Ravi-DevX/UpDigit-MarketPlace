import { clsx } from "clsx";

interface BadgeProps {
  children: React.ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
}

const toneClass: Record<NonNullable<BadgeProps["tone"]>, string> = {
  default: "bg-white/10 text-textSecondary",
  success: "bg-emerald-500/20 text-success border-emerald-400/40",
  warning: "bg-amber-500/20 text-warning border-amber-400/40",
  danger: "bg-red-500/20 text-danger border-red-400/40",
};

export function Badge({ children, tone = "default" }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium uppercase tracking-[0.08em]",
        toneClass[tone],
      )}
    >
      {children}
    </span>
  );
}
