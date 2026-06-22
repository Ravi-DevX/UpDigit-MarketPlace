import * as React from "react";
import { cn } from "@/lib/utils";

export function GridCard({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border border-border bg-surface p-4 text-left shadow-[0_18px_60px_rgba(0,0,0,0.24)] outline-none backdrop-blur-xl transition",
        "hover:-translate-y-0.5 hover:border-primary/45 hover:bg-elevated hover:shadow-[0_22px_80px_rgba(0,0,0,0.34)]",
        "focus-visible:ring-2 focus-visible:ring-primary/60",
        className,
      )}
      {...props}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />
      <div className="relative flex gap-3">{children}</div>
    </div>
  );
}
