"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Precomputed on the server; this component only filters and renders. */
export type ProgressRow = {
  exerciseId: string;
  title: string;
  attribute: "skill" | "strength";
  detail: string;
  step: number;
  totalSteps: number;
};

const SECTIONS = [
  { attribute: "skill", label: "Skill" },
  { attribute: "strength", label: "Strength" },
] as const;

/**
 * The progress overview shows only the skill and strength sections — the
 * areas athletes actually progress through — with a filter between the two.
 */
export function ProgressList({ rows }: { rows: ProgressRow[] }) {
  const [filter, setFilter] = useState<"skill" | "strength" | null>(null);

  const sections = SECTIONS.filter(
    (s) => filter === null || s.attribute === filter,
  );

  return (
    <div className="space-y-6">
      <div className="flex gap-1.5">
        {SECTIONS.map((s) => (
          <button
            key={s.attribute}
            type="button"
            onClick={() =>
              setFilter(filter === s.attribute ? null : s.attribute)
            }
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm transition-colors",
              filter === s.attribute
                ? "border-primary bg-primary text-primary-foreground"
                : "text-muted-foreground hover:border-foreground/30",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {sections.map((section) => {
        const group = rows.filter((r) => r.attribute === section.attribute);
        if (group.length === 0) return null;
        return (
          <div key={section.attribute} className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {section.label}
            </h2>
            <div className="space-y-4">
              {group.map((row) => (
                <div
                  key={row.exerciseId}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{row.title}</div>
                    <p className="text-sm text-muted-foreground">
                      {row.detail}
                    </p>
                  </div>
                  {row.step > 0 && (
                    <Badge variant="outline" className="shrink-0">
                      {row.step}/{row.totalSteps}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
