"use client";

import { Check, Trophy } from "lucide-react";
import {
  INTER_TECHNIQUES,
  MEASUREMENT_LABELS,
  TECHNIQUES_BY_ID,
} from "@/lib/domain/types";
import { Exercise, VolumeStats, WorkoutExercise } from "@/lib/domain/schemas";
import { statsKey } from "@/lib/domain/volume";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const NONE = "none";

/**
 * Mid-workout exercise sheet: read the progression descriptions, swap the
 * progression for this session, and set the inter-exercise technique + notes.
 * Changes affect only this session's log, never the program plan.
 */
export function ExerciseSessionSheet({
  open,
  onOpenChange,
  exercise,
  planned,
  progressionId,
  interTechniqueId,
  notes,
  stats,
  readOnly,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exercise: Exercise;
  planned: WorkoutExercise;
  progressionId: string;
  interTechniqueId?: string;
  notes?: string;
  stats: Record<string, VolumeStats>;
  readOnly: boolean;
  onChange: (patch: {
    progressionId?: string;
    interTechniqueId?: string | null;
    notes?: string;
  }) => void;
}) {
  const technique = interTechniqueId
    ? TECHNIQUES_BY_ID.get(interTechniqueId)
    : undefined;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto pb-8">
        <SheetHeader>
          <SheetTitle>{exercise.title}</SheetTitle>
          <SheetDescription>
            {MEASUREMENT_LABELS[exercise.measurement]}
            {exercise.repStyle === "cluster" && " · cluster reps (eccentric)"}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-4">
          <div className="space-y-2">
            <Label>Progression — tap to use a different one today</Label>
            <div className="space-y-2">
              {exercise.progressions.map((p) => {
                const s = stats[statsKey(exercise.id, p.id)];
                const active = p.id === progressionId;
                const isPlan = p.id === planned.progressionId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={readOnly}
                    onClick={() => onChange({ progressionId: p.id })}
                    className={cn(
                      "w-full rounded-lg border p-3 text-left transition-colors",
                      active
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "hover:border-foreground/30",
                      readOnly && "opacity-60",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{p.name}</span>
                      {isPlan && (
                        <Badge variant="outline" className="text-[10px]">
                          plan
                        </Badge>
                      )}
                      {active && <Check className="ml-auto size-4 text-primary" />}
                    </div>
                    {p.description && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {p.description}
                      </p>
                    )}
                    {s?.maxReps != null && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <Trophy className="size-3" /> best: {s.maxReps}
                        {exercise.measurement === "time" ? "s" : " reps"}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Inter-exercise progression technique</Label>
            <Select
              value={interTechniqueId ?? NONE}
              onValueChange={(v) =>
                onChange({ interTechniqueId: v === NONE ? null : v })
              }
              disabled={readOnly}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                {INTER_TECHNIQUES.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {technique && (
              <p className="text-xs text-muted-foreground">
                {technique.description}
              </p>
            )}
            {technique?.kind === "hybrid" && (
              <p className="text-xs font-medium text-primary">
                Pick the progression you performed next to each set on the
                workout screen.
              </p>
            )}
            {technique?.kind === "hybrid_eccentric" && (
              <p className="text-xs font-medium text-primary">
                Each set on the workout screen gets two fields: dynamic reps +
                eccentric reps.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="session-notes">
              {technique?.kind === "notes" ? `${technique.name} notes` : "Notes"}
            </Label>
            <Textarea
              id="session-notes"
              placeholder={
                technique?.prompt ??
                "How did it feel? Track your inter-exercise progression here…"
              }
              disabled={readOnly}
              value={notes ?? ""}
              onChange={(e) => onChange({ notes: e.target.value })}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
