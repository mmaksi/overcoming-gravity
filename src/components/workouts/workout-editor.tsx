"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CloudUpload, Loader2, Play, Trash2 } from "lucide-react";
import { Attribute } from "@/lib/domain/types";
import {
  CustomWorkout,
  Exercise,
  sectionOf,
  WorkoutDay,
  WorkoutExercise,
} from "@/lib/domain/schemas";
import {
  deleteCustomWorkout,
  saveCustomWorkout,
  startCustomWorkout,
} from "@/lib/actions/workouts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DaySections } from "@/components/designer/day-card";
import { ExercisePicker } from "@/components/designer/exercise-picker";
import { ExerciseEditor } from "@/components/designer/exercise-editor";
import {
  groupExercises,
  reorderExercises,
  ungroupExercises,
} from "@/components/designer/meso-utils";

type SaveState = "saved" | "dirty" | "saving";

/**
 * Editor for one standalone workout: a title plus the same day-section UI
 * as the program designer. No goals, no periodization — just exercises.
 */
export function WorkoutEditor({
  workout,
  exercises,
}: {
  workout: CustomWorkout;
  exercises: Exercise[];
}) {
  const [title, setTitle] = useState(workout.title);
  const [day, setDay] = useState<WorkoutDay>(workout.day);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const router = useRouter();
  const [pickingFor, setPickingFor] = useState<Attribute | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [starting, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, startDeleting] = useTransition();

  const exercisesById = new Map(exercises.map((e) => [e.id, e]));

  // Debounced autosave, same rhythm as the designer pages. The in-flight
  // save promise is kept so "Do this workout" can wait it out — an action
  // still running when the redirect fires swallows the navigation.
  const latest = useRef({ title, day });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflightRef = useRef<Promise<void>>(Promise.resolve());
  const schedule = useCallback(() => {
    setSaveState("dirty");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setSaveState("saving");
      inflightRef.current = saveCustomWorkout({
        id: workout.id,
        title: latest.current.title.trim() || "My workout",
        day: latest.current.day,
      }).then(
        () => setSaveState("saved"),
        () => setSaveState("dirty"),
      );
    }, 1200);
  }, [workout.id]);
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function applyDay(next: WorkoutDay) {
    latest.current = { ...latest.current, day: next };
    setDay(next);
    schedule();
  }
  function applyTitle(next: string) {
    latest.current = { ...latest.current, title: next };
    setTitle(next);
    schedule();
  }

  const editingExercise: WorkoutExercise | null =
    day.exercises.find((we) => we.id === editingId) ?? null;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Input
          aria-label="Workout title"
          className="text-lg font-semibold"
          value={title}
          maxLength={80}
          onChange={(e) => applyTitle(e.target.value)}
        />
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

      <Button
        className="w-full"
        size="lg"
        disabled={starting || day.exercises.length === 0}
        onClick={() =>
          startTransition(async () => {
            // Flush edits first so the session runs the latest plan, and so
            // no autosave overlaps the redirecting action below.
            if (timerRef.current) clearTimeout(timerRef.current);
            await inflightRef.current;
            await saveCustomWorkout({
              id: workout.id,
              title: latest.current.title.trim() || "My workout",
              day: latest.current.day,
            });
            await startCustomWorkout(workout.id);
          })
        }
      >
        {starting ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <>
            <Play className="size-4" /> Do this workout
          </>
        )}
      </Button>

      <div className="space-y-5">
        <DaySections
          dndIdPrefix={`workout-${workout.id}`}
          day={day}
          exercisesById={exercisesById}
          onAddExercise={(attribute) => setPickingFor(attribute)}
          onRemoveSection={(attribute) => {
            const remaining = day.exercises.filter(
              (we) => sectionOf(we, exercisesById) !== attribute,
            );
            applyDay({
              ...day,
              exercises: remaining,
              groups: (day.groups ?? []).filter((g) =>
                remaining.some((we) => we.groupId === g.id),
              ),
            });
          }}
          onEditExercise={(id) => setEditingId(id)}
          onRemoveExercise={(id) =>
            applyDay({
              ...day,
              exercises: day.exercises.filter((we) => we.id !== id),
            })
          }
          onReorder={(fromId, toId) =>
            applyDay(reorderExercises(day, fromId, toId))
          }
          onGroup={(ids, type) => applyDay(groupExercises(day, ids, type))}
          onUngroup={(groupId) => applyDay(ungroupExercises(day, groupId))}
        />
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogTrigger asChild>
          <Button variant="destructive" className="w-full">
            <Trash2 className="size-4" /> Delete workout
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this workout?</DialogTitle>
            <DialogDescription>
              &ldquo;{title.trim() || "My workout"}&rdquo; is removed from your
              list. Sessions you already completed stay in your history.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={() =>
                startDeleting(async () => {
                  // Stop the pending autosave from resurrecting the workout.
                  if (timerRef.current) clearTimeout(timerRef.current);
                  await deleteCustomWorkout(workout.id);
                  router.push("/programs");
                })
              }
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ExercisePicker
        key={pickingFor ?? "closed"}
        open={pickingFor !== null}
        onOpenChange={(open) => !open && setPickingFor(null)}
        exercises={exercises}
        section={pickingFor}
        onPick={(exercise) => {
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
            // Stays in the section it was added to, whatever its attribute.
            section: pickingFor ?? undefined,
          };
          applyDay({ ...day, exercises: [...day.exercises, we] });
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
          applyDay({
            ...day,
            exercises: day.exercises.map((x) => (x.id === we.id ? we : x)),
          })
        }
        onRemove={() => {
          if (!editingId) return;
          applyDay({
            ...day,
            exercises: day.exercises.filter((we) => we.id !== editingId),
          });
          setEditingId(null);
        }}
      />
    </div>
  );
}
