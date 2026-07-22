"use client";

import { ChevronDown, Plus, X } from "lucide-react";
import { GROUP_TYPE_COLORS, Measurement } from "@/lib/domain/types";
import { Exercise, WorkoutExercise } from "@/lib/domain/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { RawPart, RawSet } from "./logging-types";

/**
 * Digits only, plus a single decimal point when the unit allows fractions
 * (minute holds like 1.5). The athlete may also clear the field completely.
 */
function cleanNumeric(value: string, allowDecimal: boolean): string {
  return allowDecimal
    ? value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1")
    : value.replace(/\D/g, "");
}

/** Select the whole value on focus so typing replaces it immediately. */
function selectAll(e: React.FocusEvent<HTMLInputElement>) {
  e.target.select();
}

/**
 * A single editable set within an exercise card: the done checkbox, the
 * reps/seconds/minutes input with its unit toggle, weight or eccentric-reps
 * fields, and — for hybrid techniques — the per-progression part rows.
 */
export function SetRow({
  set,
  index,
  setCount,
  placeholder,
  isToFailureGroup,
  measurement,
  unit,
  isHybrid,
  isHybridEcc,
  readOnly,
  ex,
  we,
  toggleSetDone,
  updateSet,
  updateSetParts,
  cycleUnit,
}: {
  set: RawSet;
  index: number;
  setCount: number;
  placeholder: number;
  isToFailureGroup: boolean;
  measurement: Measurement;
  unit: string;
  isHybrid: boolean;
  isHybridEcc: boolean;
  readOnly: boolean;
  ex: Exercise;
  we: WorkoutExercise;
  toggleSetDone: (we: WorkoutExercise, setIndex: number, done: boolean) => void;
  updateSet: (
    workoutExerciseId: string,
    setIndex: number,
    patch: Partial<RawSet>,
  ) => void;
  updateSetParts: (
    workoutExerciseId: string,
    setIndex: number,
    updater: (parts: RawPart[]) => RawPart[],
  ) => void;
  cycleUnit: (workoutExerciseId: string, current: Measurement) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          aria-label={`Mark set ${index + 1} done`}
          className="size-6 shrink-0 accent-primary"
          disabled={readOnly}
          checked={set.done}
          onChange={(e) => toggleSetDone(we, index, e.target.checked)}
        />
        {/* To-Failure: the last set is the one taken to
            failure — labelled so it can't be missed. */}
        {isToFailureGroup && index === setCount - 1 ? (
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
              GROUP_TYPE_COLORS.to_failure.badge,
            )}
          >
            To-Failure
          </span>
        ) : (
          <span className="w-9 shrink-0 text-xs text-muted-foreground">
            Set {index + 1}
          </span>
        )}
        {!isHybrid && (
          <Input
            type="text"
            inputMode={measurement === "minutes" ? "decimal" : "numeric"}
            pattern={measurement === "minutes" ? "[0-9.]*" : "[0-9]*"}
            disabled={readOnly}
            placeholder={String(placeholder)}
            value={set.reps}
            onFocus={selectAll}
            onChange={(e) =>
              updateSet(we.id, index, {
                reps: cleanNumeric(e.target.value, measurement === "minutes"),
              })
            }
          />
        )}
        {!isHybrid &&
          (isHybridEcc ? (
            <span className="w-12 shrink-0 text-xs text-muted-foreground">
              dyn.
            </span>
          ) : (
            <button
              type="button"
              disabled={readOnly}
              onClick={() => cycleUnit(we.id, measurement)}
              title="Tap to switch unit: reps → seconds → minutes"
              className="flex w-12 shrink-0 items-center gap-0.5 text-left text-xs text-muted-foreground underline decoration-dotted underline-offset-2 transition-colors hover:text-foreground disabled:no-underline disabled:opacity-100"
            >
              {unit}
              {!readOnly && <ChevronDown className="size-3 shrink-0" />}
            </button>
          ))}
        {isHybridEcc ? (
          <>
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="0"
              disabled={readOnly}
              value={set.eccentricReps}
              onFocus={selectAll}
              onChange={(e) =>
                updateSet(we.id, index, {
                  eccentricReps: cleanNumeric(e.target.value, false),
                })
              }
            />
            <span className="shrink-0 text-xs text-muted-foreground">ecc.</span>
          </>
        ) : (
          !isHybrid && (
            <>
              <Input
                type="number"
                min={0}
                step={0.5}
                inputMode="decimal"
                placeholder="—"
                disabled={readOnly}
                value={set.weight}
                onFocus={selectAll}
                onChange={(e) =>
                  updateSet(we.id, index, { weight: e.target.value })
                }
              />
              <span className="shrink-0 text-xs text-muted-foreground">kg</span>
            </>
          )
        )}
      </div>

      {/* Hybrid sets: any number of reps across several
          progressions inside this one set. */}
      {isHybrid && (
        <div className="space-y-1.5 pl-8">
          {set.parts.map((part, pi) => (
            <div key={pi} className="flex items-center gap-2">
              <Select
                value={part.progressionId}
                disabled={readOnly}
                onValueChange={(progressionId) =>
                  updateSetParts(we.id, index, (parts) =>
                    parts.map((p, q) =>
                      q === pi ? { ...p, progressionId } : p,
                    ),
                  )
                }
              >
                <SelectTrigger className="min-w-0 flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ex.progressions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="0"
                disabled={readOnly}
                className="w-20 shrink-0"
                value={part.reps}
                onFocus={selectAll}
                onChange={(e) =>
                  updateSetParts(we.id, index, (parts) =>
                    parts.map((p, q) =>
                      q === pi
                        ? { ...p, reps: cleanNumeric(e.target.value, false) }
                        : p,
                    ),
                  )
                }
              />
              {set.parts.length > 1 && !readOnly && (
                <button
                  type="button"
                  aria-label="Remove progression from set"
                  className="p-1 text-muted-foreground hover:text-foreground"
                  onClick={() =>
                    updateSetParts(we.id, index, (parts) =>
                      parts.filter((_, q) => q !== pi),
                    )
                  }
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          ))}
          {!readOnly && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                updateSetParts(we.id, index, (parts) => [
                  ...parts,
                  { progressionId: ex.progressions[0].id, reps: "" },
                ])
              }
            >
              <Plus className="size-4" /> Progression in this set
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
