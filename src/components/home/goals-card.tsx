"use client";

import { useOptimistic, useTransition } from "react";
import { useMutation } from "@tanstack/react-query";
import { Target } from "lucide-react";
import { GOAL_AREA_LABELS, GOAL_AREAS, GoalArea } from "@/lib/domain/types";
import { Goals } from "@/lib/domain/schemas";
import { toggleProgramGoal } from "@/lib/actions/programs";
import { cn } from "@/lib/utils";

export type ProgramGoals = {
  programId: string;
  programName: string;
  goals: Goals;
};

type Patch = { programId: string; area: GoalArea; index: number; done: boolean };

/**
 * Goals of every active program, compiled into one dashboard list and
 * tickable in place. Optimistic so ticks feel instant.
 */
export function GoalsCard({ programs }: { programs: ProgramGoals[] }) {
  // useOptimistic must run inside a transition, so the transition stays; the
  // server write itself goes through TanStack Query. The tick reverts on its
  // own when the revalidated dashboard props arrive.
  const [, startTransition] = useTransition();
  const toggleMutation = useMutation({
    mutationFn: (patch: Patch) => toggleProgramGoal(patch),
  });
  const [optimistic, applyOptimistic] = useOptimistic(
    programs,
    (state, patch: Patch) =>
      state.map((p) =>
        p.programId === patch.programId
          ? {
              ...p,
              goals: {
                ...p.goals,
                [patch.area]: (p.goals[patch.area] ?? []).map((g, i) =>
                  i === patch.index ? { ...g, done: patch.done } : g,
                ),
              },
            }
          : p,
      ),
  );

  const showProgramName = optimistic.length > 1;
  const flat = optimistic.flatMap((p) =>
    GOAL_AREAS.flatMap((area) =>
      // Older programs may miss newer areas entirely.
      (p.goals[area] ?? []).map((goal, index) => ({
        programId: p.programId,
        programName: p.programName,
        area,
        index,
        goal,
      })),
    ),
  );
  if (flat.length === 0) return null;
  const achieved = flat.filter((x) => x.goal.done).length;

  return (
    <div className="space-y-3">
      <h2 className="flex items-center gap-2 text-base font-semibold uppercase tracking-wide text-primary">
        <Target className="size-5" /> Goals · {achieved}/{flat.length} achieved
      </h2>
      <div className="space-y-2.5">
        {flat.map(({ programId, programName, area, index, goal }) => (
          <label
            key={`${programId}-${area}-${index}`}
            className="flex min-h-11 cursor-pointer items-center gap-3"
          >
            <input
              type="checkbox"
              className="size-5 shrink-0 accent-primary"
              checked={goal.done}
              onChange={(e) => {
                const done = e.target.checked;
                startTransition(async () => {
                  applyOptimistic({ programId, area, index, done });
                  await toggleMutation.mutateAsync({
                    programId,
                    area,
                    index,
                    done,
                  });
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
                {showProgramName && ` · ${programName}`}
              </span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
