"use client";

import { useState, useTransition } from "react";
import { Loader2, Pencil, Plus, X } from "lucide-react";
import { GOAL_AREA_LABELS, GOAL_AREAS, GoalArea } from "@/lib/domain/types";
import { Goals } from "@/lib/domain/schemas";
import { updateProgramGoals } from "@/lib/actions/programs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

/** Edit a program's goals after creation — same rules as the wizard step. */
export function GoalsEditor({
  programId,
  goals,
}: {
  programId: string;
  goals: Goals | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<GoalArea, string[]>>(
    () =>
      Object.fromEntries(
        // Older programs may miss newer areas — treat them as empty.
        GOAL_AREAS.map((area) => [area, goals?.[area]?.map((g) => g.text) ?? []]),
      ) as Record<GoalArea, string[]>,
  );

  const clean = (area: GoalArea) =>
    draft[area].map((g) => g.trim()).filter(Boolean).slice(0, 2);
  const valid = GOAL_AREAS.some((area) => clean(area).length > 0);

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await updateProgramGoals({
          programId,
          goals: Object.fromEntries(
            GOAL_AREAS.map((area) => [area, clean(area)]),
          ) as Record<GoalArea, string[]>,
        });
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save goals");
      }
    });
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="size-4" /> Edit goals
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto pb-8">
          <SheetHeader>
            <SheetTitle>Goals</SheetTitle>
            <SheetDescription>
              Up to 2 goals per area — one goal in total is enough. Goals you
              don&apos;t change keep their achieved tick.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-5 px-4">
            {GOAL_AREAS.map((area) => (
              <div key={area} className="space-y-2">
                <Label>{GOAL_AREA_LABELS[area]}</Label>
                {draft[area].map((g, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      aria-label={`${GOAL_AREA_LABELS[area]} goal ${i + 1}`}
                      value={g}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          [area]: d[area].map((x, j) =>
                            j === i ? e.target.value : x,
                          ),
                        }))
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remove goal"
                      onClick={() =>
                        setDraft((d) => ({
                          ...d,
                          [area]: d[area].filter((_, j) => j !== i),
                        }))
                      }
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
                {draft[area].length < 2 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setDraft((d) => ({ ...d, [area]: [...d[area], ""] }))
                    }
                  >
                    <Plus className="size-4" /> Add goal
                  </Button>
                )}
              </div>
            ))}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button className="w-full" disabled={!valid || pending} onClick={save}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : "Save goals"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
