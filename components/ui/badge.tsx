import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-muted text-muted-foreground",
        primary: "bg-[hsl(var(--chart-1)/0.15)] text-[hsl(var(--chart-1))]",
        success: "bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))]",
        warning: "bg-[hsl(var(--warning)/0.15)] text-[hsl(var(--warning))]",
        destructive:
          "bg-[hsl(var(--destructive)/0.15)] text-[hsl(var(--destructive))]",
        outline: "border border-border text-foreground",
        r1: "bg-[hsl(var(--chart-1)/0.15)] text-[hsl(var(--chart-1))] border border-[hsl(var(--chart-1)/0.3)]",
        r2: "bg-[hsl(var(--chart-3)/0.15)] text-[hsl(var(--chart-3))] border border-[hsl(var(--chart-3)/0.3)]",
        bot: "bg-[hsl(var(--chart-4)/0.15)] text-[hsl(var(--chart-4))]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, className }))} {...props} />
  );
}
