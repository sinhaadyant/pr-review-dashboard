"use client";

import { Check, Link as LinkIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "./ui/button";

/**
 * Copies the current page URL (with all query-state filters) to clipboard.
 * Useful for sharing a specific dashboard view with teammates.
 */
export function ShareLinkButton() {
  const [copied, setCopied] = useState(false);

  const onClick = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (!url) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        // fallback for non-secure contexts
        const ta = document.createElement("textarea");
        ta.value = url;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      setCopied(true);
      toast.success("Link copied", { description: "Share this view with anyone." });
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      toast.error("Could not copy link", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      aria-label="Copy share link"
      title="Copy share link to current view"
    >
      {copied ? (
        <Check className="h-4 w-4 text-success" />
      ) : (
        <LinkIcon className="h-4 w-4" />
      )}
    </Button>
  );
}
