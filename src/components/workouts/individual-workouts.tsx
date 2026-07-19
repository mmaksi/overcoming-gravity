"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Loader2, Lock, Plus, Trash2, Zap } from "lucide-react";
import { CustomWorkout } from "@/lib/domain/schemas";
import {
  createCustomWorkout,
  deleteCustomWorkout,
} from "@/lib/actions/workouts";
import { FREE_CUSTOM_WORKOUT_LIMIT } from "@/lib/billing/entitlements";
import { PaywallDialog } from "@/components/billing/paywall";
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
  isProUser,
  showTrial = true,
}: {
  workouts: CustomWorkout[];
  isProUser: boolean;
  /** Off for lapsed subscribers — no second free trial. */
  showTrial?: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState<CustomWorkout | null>(
    null,
  );
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [optimistic, removeOptimistic] = useOptimistic(
    workouts,
    (state, deletedId: string) => state.filter((w) => w.id !== deletedId),
  );
  // Free plan: a taste of the feature, then the paywall (server backstops).
  const atFreeLimit =
    !isProUser && optimistic.length >= FREE_CUSTOM_WORKOUT_LIMIT;

  // Create then navigate to the new editor. Navigation happens after the
  // awaited mutation (see `createWorkout`), not in onSuccess: a router.push
  // queued in the same tick as the action's revalidation is swallowed in this
  // Next fork.
  const createMutation = useMutation({
    mutationFn: () => createCustomWorkout(),
  });
  function createWorkout() {
    createMutation
      .mutateAsync()
      .then((id) => router.push(`/workouts/${id}`))
      .catch(() => undefined);
  }
  // Delete's optimistic removal needs a transition (useOptimistic); only the
  // server call goes through TanStack Query.
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCustomWorkout(id),
  });

  return (
    <div className="space-y-5 border-t pt-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Zap className="size-5 text-primary" /> Individual workouts
      </h2>

      {/* Same inviting placeholder as "Create a program". It's a button (not a
          link) because creating goes through a server action, then navigates. */}
      <button
        type="button"
        disabled={createMutation.isPending}
        onClick={() => (atFreeLimit ? setPaywallOpen(true) : createWorkout())}
        className="group flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-4 text-left transition-colors hover:border-primary hover:bg-primary/10 disabled:opacity-70"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary transition-transform group-hover:scale-105">
          {createMutation.isPending ? (
            <Loader2 className="size-5 animate-spin" />
          ) : atFreeLimit ? (
            <Lock className="size-5" />
          ) : (
            <Plus className="size-6" />
          )}
        </span>
        <span className="min-w-0">
          <span className="block font-semibold">Create a workout</span>
          <span className="block text-sm text-muted-foreground">
            {atFreeLimit
              ? `Free plan: ${FREE_CUSTOM_WORKOUT_LIMIT} of ${FREE_CUSTOM_WORKOUT_LIMIT} workouts used — upgrade for unlimited.`
              : "A one-off session outside your programs."}
          </span>
        </span>
        <ChevronRight className="ml-auto size-5 shrink-0 text-muted-foreground" />
      </button>

      <PaywallDialog
        open={paywallOpen}
        onOpenChange={setPaywallOpen}
        feature={`More than ${FREE_CUSTOM_WORKOUT_LIMIT} custom workouts`}
        showTrial={showTrial}
      />

      {optimistic.length === 0 ? (
        // Mirrors the "No programs yet" placeholder above.
        <div className="space-y-1 py-8 text-center">
          <p className="font-medium">No workouts yet</p>
          <p className="text-sm text-muted-foreground">
            Tap &ldquo;Create a workout&rdquo; above to build your first one.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {optimistic.map((w) => (
            <div key={w.id} className="flex items-center gap-1">
              <Link
                href={`/workouts/${w.id}`}
                className="flex min-w-0 flex-1 items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <span className="block truncate font-semibold">
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
                  await deleteMutation
                    .mutateAsync(workout.id)
                    .catch(() => undefined);
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
