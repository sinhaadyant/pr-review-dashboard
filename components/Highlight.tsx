import type { ReactNode } from "react";

/**
 * Highlight all case-insensitive occurrences of `query` inside `text`.
 * Returns a fragment with `<mark>` around matches.
 */
export function Highlight({
  text,
  query,
}: {
  text: string;
  query?: string;
}): ReactNode {
  if (!query || !query.trim()) return text;
  const q = query.trim();
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  if (!lower.includes(needle)) return text;

  const parts: ReactNode[] = [];
  let cursor = 0;
  let idx = lower.indexOf(needle, cursor);
  let key = 0;
  while (idx !== -1) {
    if (idx > cursor) parts.push(text.slice(cursor, idx));
    parts.push(
      <mark
        key={key++}
        className="rounded-sm bg-[hsl(var(--chart-3)/0.25)] px-0.5 text-foreground"
      >
        {text.slice(idx, idx + needle.length)}
      </mark>,
    );
    cursor = idx + needle.length;
    idx = lower.indexOf(needle, cursor);
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}
