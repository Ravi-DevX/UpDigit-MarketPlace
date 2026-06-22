import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import {
  RiArrowDownLine,
  RiArrowDownSFill,
  RiArrowRightLine,
  RiArrowRightSFill,
  RiArrowUpLine,
  RiArrowUpSFill,
} from "@remixicon/react";

const badgeDeltaVariants = cva("inline-flex items-center text-tremor-label font-semibold", {
  variants: {
    variant: {
      outline: "gap-x-1 rounded-tremor-small px-2 py-1 ring-1 ring-inset ring-border",
      solid: "gap-x-1 rounded-tremor-small px-2 py-1",
      solidOutline: "gap-x-1 rounded-tremor-small px-2 py-1 ring-1 ring-inset",
      complex: "space-x-2.5 rounded-tremor-default bg-surface py-1 pl-2.5 pr-1 ring-1 ring-inset ring-border",
    },
    deltaType: { increase: "", decrease: "", neutral: "" },
    iconStyle: { filled: "", line: "" },
  },
  compoundVariants: [
    { deltaType: "increase", variant: "outline", className: "text-success" },
    { deltaType: "decrease", variant: "outline", className: "text-danger" },
    { deltaType: "neutral", variant: "outline", className: "text-textSecondary" },
    { deltaType: "increase", variant: "solid", className: "bg-success/15 text-success" },
    { deltaType: "decrease", variant: "solid", className: "bg-danger/15 text-danger" },
    { deltaType: "neutral", variant: "solid", className: "bg-elevated text-textSecondary" },
    { deltaType: "increase", variant: "solidOutline", className: "bg-success/15 text-success ring-success/20" },
    { deltaType: "decrease", variant: "solidOutline", className: "bg-danger/15 text-danger ring-danger/20" },
    { deltaType: "neutral", variant: "solidOutline", className: "bg-elevated text-textSecondary ring-border" },
  ],
});

interface BadgeDeltaProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeDeltaVariants> {
  value: string | number;
}

const DeltaIcon = ({ deltaType, iconStyle }: { deltaType: "increase" | "decrease" | "neutral"; iconStyle: "filled" | "line" }) => {
  const icons = {
    increase: { filled: RiArrowUpSFill, line: RiArrowUpLine },
    decrease: { filled: RiArrowDownSFill, line: RiArrowDownLine },
    neutral: { filled: RiArrowRightSFill, line: RiArrowRightLine },
  };
  const Icon = icons[deltaType][iconStyle];
  return <Icon className="-ml-0.5 size-4" aria-hidden />;
};

export function BadgeDelta({ className, variant = "outline", deltaType = "neutral", iconStyle = "filled", value, ...props }: BadgeDeltaProps) {
  const resolvedDelta = deltaType ?? "neutral";
  const resolvedIconStyle = iconStyle ?? "filled";
  if (variant === "complex") {
    return (
      <span className={cn(badgeDeltaVariants({ variant, className }))} {...props}>
        <span className={cn("font-semibold", resolvedDelta === "increase" && "text-success", resolvedDelta === "decrease" && "text-danger", resolvedDelta === "neutral" && "text-textSecondary")}>{value}</span>
        <span className={cn("rounded-tremor-small px-2 py-1", resolvedDelta === "increase" && "bg-success/15", resolvedDelta === "decrease" && "bg-danger/15", resolvedDelta === "neutral" && "bg-elevated")}>
          <DeltaIcon deltaType={resolvedDelta} iconStyle="line" />
        </span>
      </span>
    );
  }
  return (
    <span className={cn(badgeDeltaVariants({ variant, deltaType: resolvedDelta, className }))} {...props}>
      <DeltaIcon deltaType={resolvedDelta} iconStyle={resolvedIconStyle} />
      {value}
    </span>
  );
}
