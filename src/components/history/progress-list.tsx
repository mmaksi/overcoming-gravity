"use client";

import { useState } from "react";
import { StickyNote } from "lucide-react";
import type { ExerciseRecordGroup } from "@/lib/domain/history";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * The records overview: every trained progression, grouped by exercise, shown
 * as its own personal record (level, best set, remembered note). A filter
 * narrows to skill or strength; untrained progressions never reach here.
 */
export function ProgressList({ groups }: { groups: ExerciseRecordGroup[] }) {
  const [filter, setFilter] = useState<"skill" | "strength" | null>(null);

  const hasSkill = groups.some((g) => g.attribute === "skill");
  const hasStrength = groups.some((g) => g.attribute === "strength");
  const filters = [
    { attribute: "skill", label: "Skill", show: hasSkill },
    { attribute: "strength", label: "Strength", show: hasStrength },
  ] as const;

  const visible = groups.filter(
    (g) => filter === null || g.attribute === filter,
  );

  if (groups.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        No records yet. Log a skill or strength workout and your best sets show
        up here.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {hasSkill && hasStrength && (
        <div className="flex gap-1.5">
          {filters
            .filter((f) => f.show)
            .map((f) => (
              <button
                key={f.attribute}
                type="button"
                onClick={() =>
                  setFilter(filter === f.attribute ? null : f.attribute)
                }
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition-colors",
                  filter === f.attribute
                    ? "border-primary bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:border-foreground/30",
                )}
              >
                {f.label}
              </button>
            ))}
        </div>
      )}

      <div className="space-y-5">
        {visible.map((group) => (
          <div key={group.exerciseId} className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="truncate font-semibold">{group.title}</h3>
              <span className="shrink-0 text-xs uppercase tracking-wide text-muted-foreground">
                {group.attribute}
              </span>
            </div>
            <ul className="divide-y rounded-lg border">
              {group.records.map((record) => (
                <li key={record.progressionId} className="space-y-1 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <Badge
                        variant="outline"
                        className="shrink-0 tabular-nums"
                        title={`Level ${record.level} of ${record.totalLevels}`}
                      >
                        {record.level}/{record.totalLevels}
                      </Badge>
                      <span className="truncate text-sm font-medium">
                        {record.name}
                      </span>
                    </div>
                    <span className="shrink-0 font-semibold tabular-nums text-primary">
                      {record.best}
                    </span>
                  </div>
                  {record.note && (
                    <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <StickyNote className="mt-0.5 size-3 shrink-0" />
                      <span className="min-w-0">{record.note}</span>
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
