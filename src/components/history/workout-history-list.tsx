"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowDownUp, Clock, Trash2 } from "lucide-react";
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
  /** Compact sets summary, e.g. "3 × 8/8/6". */
  sets: string;
  /** Inter-exercise technique name; shown only when it's not plain "intra". */
  method?: string;
};

export type HistoryItem = {
  id: string;
  date: string;
  label: string;
  meta: string;
  /** Formatted workout duration (e.g. "42:10"), if recorded. */
  duration?: string;
  /** Total reps logged on push / pull movements. */
  pushVolume: number;
  pullVolume: number;
  lines: HistoryLine[];
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 rounded-lg bg-muted/60 px-2 py-1.5 text-center">
      <div className="text-sm font-bold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

/**
 * Completed workouts as compact cards: a stats strip (duration + push/pull
 * volume) over a two-column table of exercises. Each card deletes optimistically
 * with a confirm step.
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
      <div className="space-y-4">
        {optimistic.map((session) => (
          <div key={session.id} className="rounded-2xl border p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{session.date}</span>
                  <Badge variant="secondary">{session.label}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{session.meta}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete workout ${session.date}`}
                className="shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => setConfirm(session)}
              >
                <Trash2 className="size-5" />
              </Button>
            </div>

            {/* Stats strip: duration + push/pull volume. */}
            <div className="mt-3 flex gap-2">
              {session.duration && (
                <div className="flex-1 rounded-lg bg-muted/60 px-2 py-1.5 text-center">
                  <div className="flex items-center justify-center gap-1 text-sm font-bold tabular-nums">
                    <Clock className="size-3.5 text-primary" />
                    {session.duration}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Duration
                  </div>
                </div>
              )}
              <Stat label="Push vol" value={`${session.pushVolume}`} />
              <Stat label="Pull vol" value={`${session.pullVolume}`} />
            </div>

            {/* Exercise table. */}
            <Link
              href={`/workout/${session.id}`}
              className="mt-3 block overflow-hidden rounded-lg border"
            >
              <table className="w-full text-sm">
                <tbody>
                  {session.lines.map((line, i) => (
                    <tr
                      key={line.id}
                      className={i > 0 ? "border-t" : undefined}
                    >
                      <td className="px-3 py-2 font-medium">
                        <span className="flex items-center gap-1.5">
                          {line.title}
                          {line.method && (
                            <Badge className="text-[10px]">
                              <ArrowDownUp className="size-3" />
                              {line.method}
                            </Badge>
                          )}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {line.sets}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Link>
          </div>
        ))}
      </div>

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
