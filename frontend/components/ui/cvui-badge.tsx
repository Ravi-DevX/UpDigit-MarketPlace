"use client";

import React from "react";
import { motion } from "framer-motion";
import { Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

type BadgeProps = {
  label: string;
  variant?: "primary" | "secondary" | "success" | "warning" | "error";
  size?: "small" | "medium" | "large";
  icon?: React.ReactNode;
  onClick?: () => void;
  removable?: boolean;
  className?: string;
  maxWidth?: string | number;
  appearance?: "solid" | "outline" | "subtle";
  onRemove?: () => void;
  isLoading?: boolean;
};

const variantStyles = {
  primary: { solid: "bg-primary text-primary-foreground", outline: "border border-primary text-primary", subtle: "bg-primary/15 text-primary" },
  secondary: { solid: "bg-secondary text-secondary-foreground", outline: "border border-border text-textSecondary", subtle: "bg-elevated text-textSecondary" },
  success: { solid: "bg-success text-primary-foreground", outline: "border border-success text-success", subtle: "bg-success/15 text-success" },
  warning: { solid: "bg-warning text-primary-foreground", outline: "border border-warning text-warning", subtle: "bg-warning/15 text-warning" },
  error: { solid: "bg-danger text-primary-foreground", outline: "border border-danger text-danger", subtle: "bg-danger/15 text-danger" },
};

export const Badge = ({ label, variant = "primary", size = "medium", icon, onClick, removable = false, className, maxWidth, appearance = "solid", onRemove, isLoading = false }: BadgeProps) => {
  const sizeStyles = { small: "text-xs px-2 py-1", medium: "text-sm px-3 py-2", large: "text-base px-4 py-3" };
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      whileHover={{ scale: onClick ? 1.03 : 1 }}
      transition={{ duration: 0.2 }}
      onClick={(event) => { event.stopPropagation(); onClick?.(); }}
      style={{ maxWidth }}
      className={cn("inline-flex items-center gap-2 rounded-md font-medium shadow-sm backdrop-blur-sm", variantStyles[variant][appearance], sizeStyles[size], onClick && "cursor-pointer", className)}
    >
      {isLoading ? <Loader2 className="size-4 shrink-0 animate-spin" /> : icon ? <span className="shrink-0">{icon}</span> : null}
      <span className="truncate">{label}</span>
      {removable ? (
        <button type="button" title={`Remove ${label}`} onClick={(event) => { event.stopPropagation(); onRemove?.(); }} className="inline-flex size-6 items-center justify-center rounded-sm bg-surface opacity-70 hover:opacity-100">
          <X className="size-3.5" />
        </button>
      ) : null}
    </motion.div>
  );
};
