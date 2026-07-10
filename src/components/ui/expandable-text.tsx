"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Long description text clamped to a character budget with an inline
 * "See more" / "See less" toggle. Renders nothing for empty text.
 */
export function ExpandableText({
  text,
  limit = 140,
  className,
}: {
  text: string;
  limit?: number;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;

  const needsClamp = text.length > limit;
  const shown =
    !needsClamp || expanded ? text : `${text.slice(0, limit).trimEnd()}…`;

  // A span, not a <button>: this text sometimes renders inside tappable
  // rows that are themselves buttons, and buttons cannot nest.
  return (
    <p className={cn("text-sm text-muted-foreground", className)}>
      {shown}
      {needsClamp && (
        <span
          role="button"
          tabIndex={0}
          className="ml-1 cursor-pointer font-medium text-primary"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((x) => !x);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              setExpanded((x) => !x);
            }
          }}
        >
          {expanded ? "See less" : "See more"}
        </span>
      )}
    </p>
  );
}
