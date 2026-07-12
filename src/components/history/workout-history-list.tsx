"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { deleteWorkoutSession } from "@/lib/actions/runs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type HistoryLine = {
  id: string;
  title: string;
  detail: string;
  method: string;
  isInter: boolean;
  notes?: string;
};

export type HistoryItem = {
  id: string;
  date: string;
  label: string;
  meta: string;
  lines: HistoryLine[];
};

/**
 * The Workouts tab of history: each completed session with a delete button
 * that removes it optimistically (with a confirm step).
 */
export function WorkoutHistoryList({ sessions }: { sessions: HistoryItem[] }) {
  const [, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<HistoryItem | null>(null);
  const [optimistic, removeOptimistic] = useOptimistic(
    sessions,
    (state, deletedId: string) => state.filter((s) => s.id !== deletedId),
  );

  if (optimistic.length === 0) {
    return (
      <div className="space-y-1 py-8 text-center">
        <p className="font-medium">No workouts yet</p>
        <p className="text-sm text-muted-foreground">
          Completed workouts appear here with everything you logged.
        </p>
      </div>
    );
  }

  return (
    <>
      {optimistic.map((session) => (
        <div key={session.id} className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold">{session.date}</span>
            <span className="flex items-center gap-2">
              <Badge variant="secondary">{session.label}</Badge>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete workout ${session.date}`}
                className="text-muted-foreground hover:text-destructive"
                onClick={() => setConfirm(session)}
              >
                <Trash2 className="size-5" />
              </Button>
            </span>
          </div>
          <Link
            href={`/workout/${session.id}`}
            className="block space-y-2"
          >
            <p className="text-sm text-muted-foreground">{session.meta}</p>
            <div className="space-y-1.5">
              {session.lines.map((line) => (
                <div key={line.id} className="text-sm text-muted-foreground">
                  <p className="flex items-center gap-1.5">
                    <span className="font-medium text-foreground">
                      {line.title}
                    </span>{" "}
                    {line.detail}
                    <Badge
                      variant={line.isInter ? "default" : "outline"}
                      className="ml-auto shrink-0 text-[10px]"
                    >
                      {line.method}
                    </Badge>
                  </p>
                  {line.notes && <p className="pl-2 italic">“{line.notes}”</p>}
                </div>
              ))}
            </div>
          </Link>
        </div>
      ))}

      <Dialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this workout?</DialogTitle>
            <DialogDescription>
              The logged workout from {confirm?.date} is permanently removed
              from your history and progress stats.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={() => {
                const session = confirm;
                setConfirm(null);
                if (!session) return;
                startTransition(async () => {
                  removeOptimistic(session.id);
                  await deleteWorkoutSession(session.id).catch(() => undefined);
                });
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
