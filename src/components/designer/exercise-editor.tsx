"use client";

import { useState } from "react";
import { ChevronDown, Minus, Plus } from "lucide-react";
import { INTER_TECHNIQUES, TECHNIQUES_BY_ID } from "@/lib/domain/types";
import {
  Exercise,
  measurementOf,
  WorkoutExercise,
} from "@/lib/domain/schemas";
import { ExpandableText } from "@/components/ui/expandable-text";

/** Quick rest picks, shown as tappable chips (values in seconds). */
const REST_PRESETS = [
  { label: "1 min", seconds: 60 },
  { label: "1.5 min", seconds: 90 },
  { label: "2 min", seconds: 120 },
  { label: "3 min", seconds: 180 },
  { label: "4 min", seconds: 240 },
  { label: "5 min", seconds: 300 },
];
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function ExerciseEditor({
  open,
  onOpenChange,
  exercise,
  value,
  onChange,
  onRemove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exercise: Exercise | null;
  value: WorkoutExercise | null;
  onChange: (we: WorkoutExercise) => void;
  onRemove: () => void;
}) {
  if (!exercise || !value) return null;

  const set = (patch: Partial<WorkoutExercise>) =>
    onChange({ ...value, ...patch });

  const selectedProgression = exercise.progressions.find(
    (p) => p.id === value.progressionId,
  );
  const isTime =
    measurementOf(exercise, value.progressionId, value.measurement) === "time";
  const isCluster = exercise.repStyle === "cluster";
  const unitLabel = isTime ? "sec" : isCluster ? "cluster reps" : "reps";
  // Tapping the unit flips this exercise between reps and hold-time for this
  // program, overriding the progression's default measurement.
  const toggleUnit = () => set({ measurement: isTime ? "reps" : "time" });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto pb-8">
        <SheetHeader>
          <SheetTitle>{exercise.title}</SheetTitle>
          <SheetDescription>
            {exercise.progressions.map((p) => p.name).join(" → ")}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-4">
          {/* Progression */}
          <div className="space-y-2">
            <Label>Progression</Label>
            <Select
              value={value.progressionId}
              onValueChange={(progressionId) => set({ progressionId })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {exercise.progressions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedProgression?.description && (
              <ExpandableText text={selectedProgression.description} />
            )}
          </div>

          {/* Sets */}
          <div className="space-y-2">
            <Label>
              {isTime
                ? "Sets — hold seconds and optional added weight per set"
                : isCluster
                  ? "Sets — cluster reps and optional added weight per set"
                  : "Sets — reps and optional added weight per set"}
            </Label>
            <p className="text-xs text-muted-foreground">
              Tap the unit (
              <span className="underline decoration-dotted underline-offset-2">
                {isTime ? "sec" : "reps"}
              </span>
              ) next to a set to switch how this exercise is measured.
            </p>
            <div className="space-y-2">
              {value.sets.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-10 text-xs text-muted-foreground">
                    Set {i + 1}
                  </span>
                  <RepsInput
                    value={s.reps}
                    onValue={(reps) =>
                      set({
                        sets: value.sets.map((x, j) =>
                          j === i ? { ...x, reps } : x,
                        ),
                      })
                    }
                  />
                  <button
                    type="button"
                    onClick={toggleUnit}
                    title="Tap to switch between reps and hold time"
                    className="flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground underline decoration-dotted underline-offset-2 transition-colors hover:text-foreground"
                  >
                    {unitLabel}
                    <ChevronDown className="size-3" />
                  </button>
                  <Input
                    type="number"
                    min={0}
                    step={0.5}
                    inputMode="decimal"
                    className="flex-1"
                    placeholder="—"
                    value={s.weight ?? ""}
                    onChange={(e) =>
                      set({
                        sets: value.sets.map((x, j) =>
                          j === i
                            ? {
                                ...x,
                                weight:
                                  e.target.value === ""
                                    ? undefined
                                    : Math.max(0, Number(e.target.value)),
                              }
                            : x,
                        ),
                      })
                    }
                  />
                  <span className="text-xs text-muted-foreground">kg</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={value.sets.length <= 1}
                    onClick={() =>
                      set({ sets: value.sets.filter((_, j) => j !== i) })
                    }
                  >
                    <Minus className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                set({
                  sets: [...value.sets, { ...value.sets[value.sets.length - 1] }],
                })
              }
            >
              <Plus className="size-4" /> Add set
            </Button>
          </div>

          {/* Rest */}
          <div className="space-y-2">
            <Label htmlFor="rest">Rest between sets (seconds)</Label>
            <Input
              id="rest"
              type="number"
              min={0}
              step={15}
              inputMode="numeric"
              value={value.restSeconds}
              onChange={(e) =>
                set({ restSeconds: Math.max(0, Number(e.target.value) || 0) })
              }
            />
            <div className="flex flex-wrap gap-1.5">
              {REST_PRESETS.map((preset) => (
                <button
                  key={preset.seconds}
                  type="button"
                  onClick={() => set({ restSeconds: preset.seconds })}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm transition-colors",
                    value.restSeconds === preset.seconds
                      ? "border-primary bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:border-foreground/30",
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tempo */}
          <div className="space-y-2">
            <Label htmlFor="tempo">Tempo (optional)</Label>
            <Input
              id="tempo"
              placeholder="e.g. 31X1 — 3s down, 1s pause, explode up, 1s hold"
              value={value.tempo ?? ""}
              onChange={(e) =>
                set({ tempo: e.target.value || undefined })
              }
            />
          </div>

          {isCluster && (
            <div className="space-y-2">
              <Label htmlFor="cluster-rest">
                Rest between cluster reps (seconds)
              </Label>
              <Input
                id="cluster-rest"
                type="number"
                min={0}
                step={5}
                inputMode="numeric"
                value={value.clusterRestSeconds ?? 15}
                onChange={(e) =>
                  set({
                    clusterRestSeconds: Math.max(
                      0,
                      Number(e.target.value) || 0,
                    ),
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Cluster set: perform each rep separately with this short rest
                in between, then take the full set rest.
              </p>
            </div>
          )}

          {/* Progression method */}
          <div className="space-y-2">
            <Label>Progression method</Label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["intra", "Intra-exercise", "Progress by adding weight, sets or reps. The app remembers your last volume."],
                  ["inter", "Inter-exercise", "Progress by changing the exercise itself (technique below). Keep manual notes."],
                ] as const
              ).map(([method, title, desc]) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => set({ progressionMethod: method })}
                  aria-pressed={value.progressionMethod === method}
                  className={cn(
                    "rounded-lg border p-3 text-left",
                    value.progressionMethod === method
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "hover:border-foreground/30",
                  )}
                >
                  <div className="text-sm font-medium">{title}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
                </button>
              ))}
            </div>
          </div>

          {value.progressionMethod === "inter" && (
            <div className="space-y-2">
              <Label>Technique</Label>
              <Select
                value={value.interTechniqueId ?? ""}
                onValueChange={(interTechniqueId) => set({ interTechniqueId })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pick a technique" />
                </SelectTrigger>
                <SelectContent>
                  {INTER_TECHNIQUES.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {value.interTechniqueId && (
                <p className="text-xs text-muted-foreground">
                  {TECHNIQUES_BY_ID.get(value.interTechniqueId)?.description}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                You&apos;ll take notes on this technique during the workout.
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => {
                onRemove();
                onOpenChange(false);
              }}
            >
              Remove exercise
            </Button>
            <Button className="flex-1" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Target-reps input that can be cleared to empty while typing (digits only)
 * instead of snapping back to 1. The stored plan value stays a valid number:
 * clearing keeps the last value until a new number is typed, and leaving the
 * field empty restores the display on blur.
 */
function RepsInput({
  value,
  onValue,
}: {
  value: number;
  onValue: (reps: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  // Reflect external changes (e.g. duplicating a set) by resetting the draft
  // during render when the incoming value changes — the pattern React
  // recommends over a synchronising effect.
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setDraft(String(value));
  }

  return (
    <Input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      className="flex-1"
      value={draft}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "");
        setDraft(digits);
        if (digits !== "") onValue(Math.max(1, Number(digits)));
      }}
      onBlur={() => {
        if (draft === "") setDraft(String(value));
      }}
    />
  );
}
