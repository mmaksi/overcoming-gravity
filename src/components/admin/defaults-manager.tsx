"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Check, CloudUpload, Loader2 } from "lucide-react";
import { Attribute } from "@/lib/domain/types";
import {
  DefaultTemplate,
  defaultSetTarget,
  Exercise,
  measurementOf,
  sectionOf,
  WorkoutDay,
  WorkoutExercise,
} from "@/lib/domain/schemas";
import { saveTemplate } from "@/lib/actions/admin";
import { DaySections } from "@/components/designer/day-card";
import { ExercisePicker } from "@/components/designer/exercise-picker";
import { ExerciseEditor } from "@/components/designer/exercise-editor";
import {
  configureGroup,
  groupExercises,
  reorderExercises,
  ungroupExercises,
} from "@/components/designer/meso-utils";

type SaveState = "saved" | "dirty" | "saving";

/**
 * The default template is one workout day, edited with exactly the same
 * section UI as the program designer. Athletes get a copy of this day on
 * every new program day (their strength section always starts empty).
 */
export function DefaultsManager({
  template,
  exercises,
}: {
  template: DefaultTemplate;
  exercises: Exercise[];
}) {
  const [day, setDay] = useState<WorkoutDay>(template.day);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [pickingFor, setPickingFor] = useState<Attribute | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const exercisesById = new Map(exercises.map((e) => [e.id, e]));

  // Debounced autosave, same rhythm as the mesocycle designer.
  const dayRef = useRef(day);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { mutateAsync: autosaveTemplate } = useMutation({
    mutationFn: () => saveTemplate({ id: "default", day: dayRef.current }),
    onMutate: () => setSaveState("saving"),
    onSuccess: () => setSaveState("saved"),
    onError: () => setSaveState("dirty"),
  });
  const apply = useCallback(
    (next: WorkoutDay) => {
      dayRef.current = next;
      setDay(next);
      setSaveState("dirty");
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        autosaveTemplate().catch(() => undefined);
      }, 1200);
    },
    [autosaveTemplate],
  );
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const editingExercise: WorkoutExercise | null =
    day.exercises.find((we) => we.id === editingId) ?? null;

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          Recommended defaults every new workout day starts with. Athletes can
          modify them freely; their strength section always starts empty.
        </p>
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

      <div className="space-y-5">
        <DaySections
          dndIdPrefix="defaults"
          day={day}
          exercisesById={exercisesById}
          onAddExercise={(attribute) => setPickingFor(attribute)}
          onRemoveSection={(attribute) => {
            const remaining = day.exercises.filter(
              (we) => sectionOf(we, exercisesById) !== attribute,
            );
            apply({
              ...day,
              exercises: remaining,
              groups: (day.groups ?? []).filter((g) =>
                remaining.some((we) => we.groupId === g.id),
              ),
            });
          }}
          onEditExercise={(id) => setEditingId(id)}
          onRemoveExercise={(id) =>
            apply({
              ...day,
              exercises: day.exercises.filter((we) => we.id !== id),
            })
          }
          onReorder={(fromId, toId) =>
            apply(reorderExercises(day, fromId, toId))
          }
          onGroup={(ids, type) => apply(groupExercises(day, ids, type))}
          onUngroup={(groupId) => apply(ungroupExercises(day, groupId))}
          onConfigureGroup={(groupId, patch) =>
            apply(configureGroup(day, groupId, patch))
          }
        />
      </div>

      <ExercisePicker
        key={pickingFor ?? "closed"}
        open={pickingFor !== null}
        onOpenChange={(open) => !open && setPickingFor(null)}
        exercises={exercises}
        section={pickingFor}
        onPick={(exercise) => {
          const defaultValue = defaultSetTarget(
            measurementOf(exercise, exercise.progressions[0].id),
          );
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
            section: pickingFor ?? undefined,
          };
          apply({ ...day, exercises: [...day.exercises, we] });
          setPickingFor(null);
          setEditingId(we.id);
        }}
      />

      <ExerciseEditor
        open={editingId !== null}
        onOpenChange={(open) => !open && setEditingId(null)}
        exercise={
          editingExercise
            ? (exercisesById.get(editingExercise.exerciseId) ?? null)
            : null
        }
        value={editingExercise}
        onChange={(we) =>
          apply({
            ...day,
            exercises: day.exercises.map((x) => (x.id === we.id ? we : x)),
          })
        }
        onRemove={() => {
          if (!editingId) return;
          apply({
            ...day,
            exercises: day.exercises.filter((we) => we.id !== editingId),
          });
          setEditingId(null);
        }}
      />
    </div>
  );
}
