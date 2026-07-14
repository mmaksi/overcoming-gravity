"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { CalendarCheck, Loader2, Play } from "lucide-react";
import { Weekday, WEEKDAY_LABELS, WEEKDAYS } from "@/lib/domain/types";
import {
  addDays,
  nextOccurrence,
  parseISODate,
  toISODate,
  weekdayOf,
} from "@/lib/domain/schedule";
import { startRun } from "@/lib/actions/runs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** First date on/after `fromISO` that falls on a training day. */
function firstWorkoutDate(fromISO: string, trainingDays: Weekday[]): Date {
  let date = parseISODate(fromISO);
  for (let i = 0; i < 7; i++) {
    if (trainingDays.includes(weekdayOf(date))) return date;
    date = addDays(date, 1);
  }
  return date;
}

function friendly(date: Date): string {
  const today = toISODate(new Date());
  const iso = toISODate(date);
  if (iso === today) return "today";
  if (iso === toISODate(addDays(new Date(), 1))) return "tomorrow";
  return `${WEEKDAY_LABELS[weekdayOf(date)]}, ${iso}`;
}

export function StartRunButton({
  programId,
  trainingDays,
  label,
  variant = "default",
}: {
  programId: string;
  trainingDays: Weekday[];
  label: string;
  variant?: "default" | "outline";
}) {
  const [open, setOpen] = useState(false);
  const firstTrainingDay = useMemo(
    () => WEEKDAYS.find((d) => trainingDays.includes(d)) ?? "mon",
    [trainingDays],
  );
  const todayISO = toISODate(new Date());
  const patternStartISO = useMemo(
    () => toISODate(nextOccurrence(new Date(), firstTrainingDay)),
    [firstTrainingDay],
  );
  const [startDate, setStartDate] = useState(todayISO);
  const router = useRouter();
  // Navigate after awaiting the mutation (not in onSuccess): a router.push
  // queued in the same tick as the action's revalidation is swallowed in this
  // Next fork.
  const startMutation = useMutation({
    mutationFn: () => startRun({ programId, startDate }),
  });

  const firstWorkout = firstWorkoutDate(startDate, trainingDays);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} className="w-full">
          <Play className="size-4" /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start this program</DialogTitle>
          <DialogDescription>
            Weeks follow the calendar (Mon–Sun). Your workouts land on your
            training days from the start date on.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setStartDate(todayISO)}
              aria-pressed={startDate === todayISO}
              className={cn(
                "rounded-lg border p-2 text-sm font-medium",
                startDate === todayISO &&
                  "border-primary bg-primary/5 ring-1 ring-primary",
              )}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setStartDate(patternStartISO)}
              aria-pressed={startDate === patternStartISO}
              className={cn(
                "rounded-lg border p-2 text-sm font-medium",
                startDate === patternStartISO &&
                  "border-primary bg-primary/5 ring-1 ring-primary",
              )}
            >
              Next {WEEKDAY_LABELS[firstTrainingDay]}
            </button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="start-date">Start date</Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <p className="flex items-center gap-1.5 rounded-lg bg-muted p-2 text-sm font-medium">
            <CalendarCheck className="size-4 shrink-0 text-primary" />
            First workout: {friendly(firstWorkout)}
          </p>

        </div>
        <DialogFooter>
          <Button
            disabled={startMutation.isPending || !startDate}
            onClick={() =>
              startMutation
                .mutateAsync()
                .then(() => router.push("/"))
                .catch(() => undefined)
            }
          >
            {startMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Start"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
