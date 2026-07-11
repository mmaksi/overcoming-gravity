"use client";

import { useOptimistic, useTransition } from "react";
import { Target } from "lucide-react";
import { GOAL_AREA_LABELS, GOAL_AREAS, GoalArea } from "@/lib/domain/types";
import { Goals } from "@/lib/domain/schemas";
import { toggleProgramGoal } from "@/lib/actions/programs";
import { cn } from "@/lib/utils";

/**
 * The active program's goals, tickable straight from the dashboard.
 * Optimistic so the tick feels instant while the server action runs.
 */
export function GoalsCard({
  programId,
  goals,
}: {
  programId: string;
  goals: Goals;
}) {
  const [, startTransition] = useTransition();
  const [optimistic, applyOptimistic] = useOptimistic(
    goals,
    (state, patch: { area: GoalArea; index: number; done: boolean }) => ({
      ...state,
      [patch.area]: state[patch.area].map((g, i) =>
        i === patch.index ? { ...g, done: patch.done } : g,
      ),
    }),
  );

  const total = GOAL_AREAS.reduce((n, a) => n + optimistic[a].length, 0);
  if (total === 0) return null;
  const achieved = GOAL_AREAS.reduce(
    (n, a) => n + optimistic[a].filter((g) => g.done).length,
    0,
  );

  return (
    <div className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        <Target className="size-4" /> Goals · {achieved}/{total} achieved
      </h2>
      <div className="space-y-2.5">
        {GOAL_AREAS.map((area) =>
          optimistic[area].map((goal, index) => (
            <label
              key={`${area}-${index}`}
              className="flex min-h-11 cursor-pointer items-center gap-3"
            >
              <input
                type="checkbox"
                className="size-5 shrink-0 accent-primary"
                checked={goal.done}
                onChange={(e) => {
                  const done = e.target.checked;
                  startTransition(async () => {
                    applyOptimistic({ area, index, done });
                    await toggleProgramGoal({ programId, area, index, done });
                  });
                }}
              />
              <span className="min-w-0">
                <span
                  className={cn(
                    "block truncate",
                    goal.done && "text-muted-foreground line-through",
                  )}
                >
                  {goal.text}
                </span>
                <span className="text-xs text-muted-foreground">
                  {GOAL_AREA_LABELS[area]}
                </span>
              </span>
            </label>
          )),
        )}
      </div>
    </div>
  );
}
