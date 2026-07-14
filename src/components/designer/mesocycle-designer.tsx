"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Check, CloudUpload, Copy, Loader2 } from "lucide-react";
import {
  Attribute,
  WEEK_FOCUS_LABELS,
  Weekday,
  WEEKDAYS,
} from "@/lib/domain/types";
import {
  Exercise,
  measurementOf,
  Mesocycle,
  Program,
  sectionOf,
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
}: {
  program: Program;
  exercises: Exercise[];
}) {
  const router = useRouter();
  const [meso, setMeso] = useState<Mesocycle>(program.mesocycle);
  const [weekIndex, setWeekIndex] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("saved");

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
  // Light / Heavy tags individual days; Accumulation & Intensification tags
  // whole weeks instead.
  const dayPeriodized = program.periodization === "high_low";
  const weekPeriodized = program.periodization === "daily_undulating";

  // Debounced autosave -------------------------------------------------------
  const mesoRef = useRef(meso);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced draft autosave, routed through TanStack Query. Draft saves pass
  // no `final` flag, so they persist without busting any cache.
  const { mutateAsync: autosaveMeso } = useMutation({
    mutationFn: () =>
      saveMesocycle({ programId: program.id, mesocycle: mesoRef.current }),
    onMutate: () => setSaveState("saving"),
    onSuccess: () => setSaveState("saved"),
    onError: () => setSaveState("dirty"),
  });
  const apply = useCallback(
    (next: Mesocycle) => {
      mesoRef.current = next;
      setMeso(next);
      setSaveState("dirty");
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        autosaveMeso().catch(() => undefined);
      }, 1200);
    },
    [autosaveMeso],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Finish: flush the debounce, do the final (cache-busting) save, activate the
  // program if it's still a draft. Navigation happens after the awaited mutation
  // (in the click handler, not onSuccess): a router.push queued in the same tick
  // as the action's revalidation is swallowed in this Next fork.
  const finishMutation = useMutation({
    mutationFn: async () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      await saveMesocycle({
        programId: program.id,
        mesocycle: mesoRef.current,
        final: true,
      });
      if (program.status === "draft") {
        await activateProgram(program.id);
      }
    },
  });
  const finishing = finishMutation.isPending;
  function finish() {
    finishMutation
      .mutateAsync()
      .then(() => router.push(`/programs/${program.id}`))
      .catch(() => undefined);
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
        <Button onClick={finish} disabled={finishing}>
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
            {w.focus && (
              <span className="ml-1 text-[10px]">
                {w.focus === "accumulation" ? "acc" : "int"}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Brief how-to for the chosen periodization. */}
      {weekPeriodized && (
        <Alert>
          <AlertTitle>Accumulation & Intensification</AlertTitle>
          <AlertDescription>
            Pick each exercise once — it carries across every week.{" "}
            <span className="font-medium text-sky-600 dark:text-sky-400">
              Accumulation
            </span>{" "}
            weeks (blue) build volume: more sets/reps on easier progressions.{" "}
            <span className="font-medium text-orange-600 dark:text-orange-400">
              Intensification
            </span>{" "}
            weeks (orange) push intensity: harder progressions, fewer reps,
            longer rest. Flip a week&apos;s phase with the badge below.
          </AlertDescription>
        </Alert>
      )}
      {dayPeriodized && (
        <Alert>
          <AlertTitle>Light / Heavy days</AlertTitle>
          <AlertDescription>
            Pick each exercise once.{" "}
            <span className="font-medium text-orange-600 dark:text-orange-400">
              Heavy
            </span>{" "}
            days (orange) are your hard sessions — top progressions, low reps.{" "}
            <span className="font-medium text-sky-600 dark:text-sky-400">
              Light
            </span>{" "}
            days (blue) stay easy so you recover. Flip a day with its badge.
          </AlertDescription>
        </Alert>
      )}

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
        <span className="flex items-center gap-2">
          <Badge variant="outline">
            Week {weekIndex + 1} of {meso.weeks.length}
          </Badge>
          {weekPeriodized && !week?.isDeload && (
            <button
              type="button"
              title="Toggle accumulation/intensification"
              onClick={() =>
                apply({
                  weeks: meso.weeks.map((w) =>
                    w.index === weekIndex
                      ? {
                          ...w,
                          focus:
                            w.focus === "accumulation"
                              ? ("intensification" as const)
                              : ("accumulation" as const),
                        }
                      : w,
                  ),
                })
              }
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide",
                week?.focus === "intensification"
                  ? "bg-orange-500/15 text-orange-600 dark:text-orange-400"
                  : "bg-sky-500/15 text-sky-600 dark:text-sky-400",
              )}
            >
              {WEEK_FOCUS_LABELS[week?.focus ?? "accumulation"]}
            </button>
          )}
        </span>
        <Button variant="outline" size="sm" onClick={() => setCopyingWeek(true)}>
          <Copy className="size-4" /> Copy week to…
        </Button>
      </div>

      {/* Days — separated by generous spacing rather than boxes. In
          Accumulation & Intensification the whole week gets a phase tint so
          which phase you're editing reads at a glance. */}
      <div
        className={cn(
          "space-y-10",
          weekPeriodized &&
            !week?.isDeload &&
            "-mx-2 rounded-2xl p-3 transition-colors",
          weekPeriodized &&
            !week?.isDeload &&
            (week?.focus === "intensification"
              ? "bg-orange-500/[0.06]"
              : "bg-sky-500/[0.06]"),
        )}
      >
        {orderedDays.map((weekday) => {
          const day = week?.days[weekday];
          if (!day) return null;
          return (
            <DayCard
              key={weekday}
              weekday={weekday}
              day={day}
              periodized={dayPeriodized}
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
                      (we) => sectionOf(we, exercisesById) !== attribute,
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
        key={pickingFor ? `${pickingFor.weekday}-${pickingFor.attribute}` : "closed"}
        open={pickingFor !== null}
        onOpenChange={(open) => !open && setPickingFor(null)}
        exercises={exercises}
        section={pickingFor?.attribute ?? null}
        onPick={(exercise) => {
          if (!pickingFor) return;
          const { weekday } = pickingFor;
          const defaultValue =
            measurementOf(exercise, exercise.progressions[0].id) === "time"
              ? 10
              : 8;
          const we: WorkoutExercise = {
            id: crypto.randomUUID(),
            exerciseId: exercise.id,
            progressionId: exercise.progressions[0].id,
            sets: Array.from({ length: 3 }, () => ({ reps: defaultValue })),
            restSeconds: 90,
            clusterRestSeconds:
              exercise.repStyle === "cluster" ? 15 : undefined,
            progressionMethod: "intra",
            // Stays in the section it was added to, whatever its attribute.
            section: pickingFor.attribute,
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
