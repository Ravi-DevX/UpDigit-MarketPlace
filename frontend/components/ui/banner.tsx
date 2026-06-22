"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Button } from "./button";

const bannerVariants = cva("relative overflow-hidden rounded-md border text-sm shadow-theme", {
  variants: {
    variant: {
      default: "border-border bg-elevated text-foreground",
      success: "border-success/35 bg-success/10 text-success",
      warning: "border-warning/35 bg-warning/10 text-warning",
      info: "border-primary/35 bg-primary/10 text-foreground",
      premium: "border-primary/40 bg-primary/15 text-foreground",
      gradient: "border-border bg-surface text-foreground",
    },
    size: { default: "px-3 py-2", sm: "px-2 py-1 text-xs", lg: "px-6 py-4 text-lg" },
  },
  defaultVariants: { variant: "default", size: "default" },
});

type BannerProps = React.ComponentProps<"div"> & VariantProps<typeof bannerVariants> & {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  showShade?: boolean;
  show?: boolean;
  onHide?: () => void;
  action?: React.ReactNode;
  closable?: boolean;
  autoHide?: number;
};

export function Banner({ variant = "default", size = "default", title, description, icon, showShade = false, show = true, onHide, action, closable = false, className, autoHide, ...props }: BannerProps) {
  React.useEffect(() => {
    if (!autoHide) return;
    const timer = window.setTimeout(() => onHide?.(), autoHide);
    return () => window.clearTimeout(timer);
  }, [autoHide, onHide]);
  if (!show) return null;
  return (
    <div className={cn(bannerVariants({ variant, size }), className)} role={variant === "warning" || variant === "default" ? "alert" : "status"} {...props}>
      {showShade ? <div className="absolute inset-0 -z-10 -skew-x-12 bg-gradient-to-r from-transparent via-white/10 to-transparent" /> : null}
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {icon ? <div className="shrink-0">{icon}</div> : null}
          <div className="min-w-0 flex-1"><p className="truncate font-semibold">{title}</p>{description ? <p className="text-xs opacity-80">{description}</p> : null}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">{action}{closable ? <Button type="button" onClick={onHide} size="icon" variant="ghost"><X className="size-4" /></Button> : null}</div>
      </div>
    </div>
  );
}
