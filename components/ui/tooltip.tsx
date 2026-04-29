"use client";

import { cn } from "@/lib/utils";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom";
  delayMs?: number;
  className?: string;
}

/**
 * Minimal accessible tooltip that wraps its children in a span and listens
 * for hover/focus on that wrapper. The wrapper also carries `aria-describedby`
 * so screen readers announce the description while the tooltip is open.
 *
 * (We intentionally avoid `React.cloneElement` here because React 19's
 * `react-hooks/refs` rule flags ref forwarding through cloneElement.)
 */
export function Tooltip({
  content,
  children,
  side = "top",
  delayMs = 250,
  className,
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  const tid = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = useId();

  useEffect(
    () => () => {
      if (tid.current) clearTimeout(tid.current);
    },
    [],
  );

  const show = () => {
    if (tid.current) clearTimeout(tid.current);
    tid.current = setTimeout(() => setOpen(true), delayMs);
  };
  const hide = () => {
    if (tid.current) clearTimeout(tid.current);
    setOpen(false);
  };

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      aria-describedby={open ? id : undefined}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          id={id}
          className={cn(
            "pointer-events-none absolute left-1/2 -translate-x-1/2 z-50 max-w-xs whitespace-normal rounded-md border border-border bg-card px-2.5 py-1.5 text-xs shadow-lg animate-fade-in",
            side === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5",
            className,
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}
