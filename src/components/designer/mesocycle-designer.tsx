"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CloudUpload, Copy, Loader2 } from "lucide-react";
import { Attribute, Weekday, WEEKDAYS } from "@/lib/domain/types";
import {
  Exercise,
  Mesocycle,
  Program,
  WorkoutExercise,
} from "@/lib/domain/schemas";
import { activateProgram, saveMesocycle } from "@/lib/actions/programs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DayCard } from "./day-card";
import { ExercisePicker } from "./exercise-picker";
import { ExerciseEditor } from "./exercise-editor";
import { CopyDayDialog, CopyWeekDialog } from "./copy-dialogs";
import {
  copyDayToDays,
  copyWeekToWeeks,
  groupExercises,
  reorderExercises,
  ungroupExercises,
  updateDay,
  updateExercise,
} from "./meso-utils";
import { cn } from "@/lib/utils";

type SaveState = "saved" | "dirty" | "saving";

export function MesocycleDesigner({
  program,
  exercises,
  userNotes,
}: {
  program: Program;
  exercises: Exercise[];
  /** Remembered notes keyed `${exerciseId}:${techniqueId}` (see schemas). */
  userNotes: Record<string, string>;
}) {
  const router = useRouter();
  const [meso, setMeso] = useState<Mesocycle>(program.mesocycle);
  const [weekIndex, setWeekIndex] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [finishing, setFinishing] = useState(false);

  // Editor / picker / copy-dialog targets
  const [editing, setEditing] = useState<{
    weekday: Weekday;
    workoutExerciseId: string;
  } | null>(null);
  const [pickingFor, setPickingFor] = useState<{
    weekday: Weekday;
    attribute: Attribute;
  } | null>(null);
  const [copyingDay, setCopyingDay] = useState<Weekday | null>(null);
  const [copyingWeek, setCopyingWeek] = useState(false);

  const exercisesById = useMemo(
    () => new Map(exercises.map((e) => [e.id, e])),
    [exercises],
  );
  const orderedDays = useMemo(
    () => WEEKDAYS.filter((d) => program.trainingDays.includes(d)),
    [program.trainingDays],
  );
  const week = meso.weeks[weekIndex];
  const periodized = program.periodization !== "none";

  // Debounced autosave -------------------------------------------------------
  const mesoRef = useRef(meso);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const apply = useCallback((next: Mesocycle) => {
    mesoRef.current = next;
    setMeso(next);
    setSaveState("dirty");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setSaveState("saving");
      try {
        await saveMesocycle({
          programId: program.id,
          mesocycle: mesoRef.current,
        });
        setSaveState("saved");
      } catch {
        setSaveState("dirty");
      }
    }, 1200);
  }, [program.id]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  async function finishDesign() {
    setFinishing(true);
    try {
      if (timerRef.current) clearTimeout(timerRef.current);
      await saveMesocycle({ programId: program.id, mesocycle: mesoRef.current });
      if (program.status === "draft") {
        await activateProgram(program.id);
      } else {
        router.push(`/programs/${program.id}`);
      }
    } catch (e) {
      if (e && typeof e === "object" && "digest" in e) throw e;
      setFinishing(false);
    }
  }

  const editingExercise: WorkoutExercise | null = editing
    ? (week?.days[editing.weekday]?.exercises.find(
        (we) => we.id === editing.workoutExerciseId,
      ) ?? null)
    : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold">{program.name}</h1>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            {saveState === "saved" && (
              <>
                <Check className="size-3" /> Saved
              </>
            )}
            {saveState === "dirty" && (
              <>
                <CloudUpload className="size-3" /> Unsaved changes…
              </>
            )}
            {saveState === "saving" && (
              <>
                <Loader2 className="size-3 animate-spin" /> Saving…
              </>
            )}
          </p>
        </div>
        <Button onClick={finishDesign} disabled={finishing}>
          {finishing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : program.status === "draft" ? (
            "Finish & activate"
          ) : (
            "Done"
          )}
        </Button>
      </div>

      {/* Week tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {meso.weeks.map((w) => (
          <button
            key={w.index}
            type="button"
            onClick={() => setWeekIndex(w.index)}
            className={cn(
              "shrink-0 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
              w.index === weekIndex
                ? "border-primary bg-primary text-primary-foreground"
                : "hover:border-foreground/30",
            )}
          >
            W{w.index + 1}
            {w.isDeload && <span className="ml-1 text-[10px]">deload</span>}
          </button>
        ))}
      </div>

      {week?.isDeload && (
        <Alert>
          <AlertTitle>Deload week</AlertTitle>
          <AlertDescription>
            End your mesocycle easy: keep the movements but cut sets or reps to
            about half so your body recovers before the next cycle.
          </AlertDescription>
        </Alert>
      )}

      {/* Week toolbar */}
      <div className="flex items-center justify-between">
        <Badge variant="outline">
          Week {weekIndex + 1} of {meso.weeks.length}
        </Badge>
        <Button variant="outline" size="sm" onClick={() => setCopyingWeek(true)}>
          <Copy className="size-4" /> Copy week to…
        </Button>
      </div>

      {/* Days — separated by generous spacing rather than boxes */}
      <div className="space-y-10">
        {orderedDays.map((weekday) => {
          const day = week?.days[weekday];
          if (!day) return null;
          return (
            <DayCard
              key={weekday}
              weekday={weekday}
              day={day}
              periodized={periodized}
              exercisesById={exercisesById}
              onToggleIntensity={() =>
                apply(
                  updateDay(meso, weekIndex, weekday, (d) => ({
                    ...d,
                    intensity: d.intensity === "high" ? "low" : "high",
                  })),
                )
              }
              onCopyDay={() => setCopyingDay(weekday)}
              onAddExercise={(attribute) =>
                setPickingFor({ weekday, attribute })
              }
              onRemoveSection={(attribute) =>
                apply(
                  updateDay(meso, weekIndex, weekday, (d) => {
                    const remaining = d.exercises.filter(
                      (we) =>
                        (exercisesById.get(we.exerciseId)?.attribute ??
                          "strength") !== attribute,
                    );
                    return {
                      ...d,
                      exercises: remaining,
                      groups: (d.groups ?? []).filter((g) =>
                        remaining.some((we) => we.groupId === g.id),
                      ),
                    };
                  }),
                )
              }
              onEditExercise={(workoutExerciseId) =>
                setEditing({ weekday, workoutExerciseId })
              }
              onRemoveExercise={(workoutExerciseId) =>
                apply(
                  updateDay(meso, weekIndex, weekday, (d) => ({
                    ...d,
                    exercises: d.exercises.filter(
                      (we) => we.id !== workoutExerciseId,
                    ),
                  })),
                )
              }
              onReorder={(fromId, toId) =>
                apply(
                  updateDay(meso, weekIndex, weekday, (d) =>
                    reorderExercises(d, fromId, toId),
                  ),
                )
              }
              onGroup={(ids, type) =>
                apply(
                  updateDay(meso, weekIndex, weekday, (d) =>
                    groupExercises(d, ids, type),
                  ),
                )
              }
              onUngroup={(groupId) =>
                apply(
                  updateDay(meso, weekIndex, weekday, (d) =>
                    ungroupExercises(d, groupId),
                  ),
                )
              }
            />
          );
        })}
      </div>

      {/* Sheets & dialogs */}
      <ExercisePicker
        open={pickingFor !== null}
        onOpenChange={(open) => !open && setPickingFor(null)}
        exercises={exercises}
        lockedAttribute={pickingFor?.attribute ?? null}
        onPick={(exercise) => {
          if (!pickingFor) return;
          const { weekday } = pickingFor;
          const defaultValue = exercise.measurement === "time" ? 10 : 8;
          const we: WorkoutExercise = {
            id: crypto.randomUUID(),
            exerciseId: exercise.id,
            progressionId: exercise.progressions[0].id,
            sets: Array.from({ length: 3 }, () => ({ reps: defaultValue })),
            restSeconds: 90,
            clusterRestSeconds:
              exercise.repStyle === "cluster" ? 15 : undefined,
            progressionMethod: "intra",
          };
          apply(
            updateDay(meso, weekIndex, weekday, (d) => ({
              ...d,
              exercises: [...d.exercises, we],
            })),
          );
          setPickingFor(null);
          setEditing({ weekday, workoutExerciseId: we.id });
        }}
      />

      <ExerciseEditor
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        exercise={
          editingExercise
            ? (exercisesById.get(editingExercise.exerciseId) ?? null)
            : null
        }
        value={editingExercise}
        userNotes={userNotes}
        onChange={(we) => {
          if (!editing) return;
          apply(
            updateExercise(meso, weekIndex, editing.weekday, we.id, () => we),
          );
        }}
        onRemove={() => {
          if (!editing) return;
          apply(
            updateDay(meso, weekIndex, editing.weekday, (d) => ({
              ...d,
              exercises: d.exercises.filter(
                (we) => we.id !== editing.workoutExerciseId,
              ),
            })),
          );
          setEditing(null);
        }}
      />

      <CopyDayDialog
        open={copyingDay !== null}
        onOpenChange={(open) => !open && setCopyingDay(null)}
        source={copyingDay}
        targets={orderedDays.filter((d) => d !== copyingDay)}
        onCopy={(targets) => {
          if (!copyingDay) return;
          apply(copyDayToDays(meso, weekIndex, copyingDay, targets));
        }}
      />

      <CopyWeekDialog
        open={copyingWeek}
        onOpenChange={setCopyingWeek}
        sourceIndex={weekIndex}
        weekCount={meso.weeks.length}
        deloadIndex={meso.weeks.length - 1}
        onCopy={(targets) => apply(copyWeekToWeeks(meso, weekIndex, targets))}
      />
    </div>
  );
}
