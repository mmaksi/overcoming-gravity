"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import {
  ChevronRight,
  Dumbbell,
  Loader2,
  Plus,
  Trash2,
  Zap,
} from "lucide-react";
import { CustomWorkout } from "@/lib/domain/schemas";
import {
  createCustomWorkout,
  deleteCustomWorkout,
} from "@/lib/actions/workouts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * The "Individual workouts" section of the Programs page. All mutations are
 * optimistic: deleting removes the row instantly, creating shows a pending
 * button while the new workout's editor is being prepared.
 */
export function IndividualWorkouts({
  workouts,
}: {
  workouts: CustomWorkout[];
}) {
  const [, startTransition] = useTransition();
  const [creating, startCreating] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState<CustomWorkout | null>(
    null,
  );
  const [optimistic, removeOptimistic] = useOptimistic(
    workouts,
    (state, deletedId: string) => state.filter((w) => w.id !== deletedId),
  );

  return (
    <div className="space-y-5 border-t pt-6">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Zap className="size-5 text-primary" /> Individual workouts
        </h2>
        <Button
          variant="outline"
          size="sm"
          disabled={creating}
          onClick={() => startCreating(() => createCustomWorkout())}
        >
          {creating ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}{" "}
          New workout
        </Button>
      </div>
      {optimistic.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          One-off workouts outside any program — just a bunch of exercises
          with a title.
        </p>
      ) : (
        <div className="space-y-4">
          {optimistic.map((w) => (
            <div key={w.id} className="flex items-center gap-1">
              <Link
                href={`/workouts/${w.id}`}
                className="flex min-w-0 flex-1 items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <span className="flex items-center gap-2 truncate font-semibold">
                    <Dumbbell className="size-4 shrink-0 text-primary" />
                    {w.title}
                  </span>
                  <p className="text-sm text-muted-foreground">
                    {w.day.exercises.length} exercises
                  </p>
                </div>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
              </Link>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${w.title}`}
                className="shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => setConfirmDelete(w)}
              >
                <Trash2 className="size-5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={confirmDelete !== null}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this workout?</DialogTitle>
            <DialogDescription>
              &ldquo;{confirmDelete?.title}&rdquo; is removed from your list.
              Sessions you already completed stay in your history.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={() => {
                const workout = confirmDelete;
                setConfirmDelete(null);
                if (!workout) return;
                startTransition(async () => {
                  // The row disappears instantly; the server catches up.
                  removeOptimistic(workout.id);
                  await deleteCustomWorkout(workout.id).catch(() => undefined);
                });
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
