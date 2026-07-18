"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Flag, TrendingDown, TrendingUp, X } from "lucide-react";
import { GROUP_TYPE_LABELS } from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ClimbSettings,
  ClimbType,
  completeStep,
  failStep,
  startClimb,
  totalReps,
} from "./climb";
import { PREP_SECONDS } from "./interval";
import { COUNTDOWN_SRC, createSound, playSound } from "./sounds";
import { cn } from "@/lib/utils";

/** Best-effort haptic tick when a new step begins. */
function vibrate() {
  try {
    navigator.vibrate?.([180, 80, 180]);
  } catch {
    // Unsupported — the visual change is enough.
  }
}

/**
 * Runs a ladder or pyramid live: each step owns one interval of the clock —
 * do the step's reps, tap done, rest until the interval ends, and the next
 * step starts by itself. "Can't complete" ends a ladder (a pyramid turns
 * around and climbs back down). Nothing is written while running; the
 * completed steps are handed to `onRecord` in one batch at the end, so the
 * logger's autosave persists the whole run as a single request.
 *
 * Mount with a fresh `key` per opening — the run starts with a short
 * get-ready countdown (with its "4… 3… 2… 1" sound), then the first step.
 */
export function ClimbRunner({
  open,
  onOpenChange,
  type,
  exerciseTitle,
  settings,
  onRecord,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: ClimbType;
  exerciseTitle: string;
  settings: ClimbSettings;
  onRecord: (reps: number[]) => void;
}) {
  const [climb, setClimb] = useState(() => startClimb(settings));
  /** Current step's reps are done — riding out the interval as rest. */
  const [resting, setResting] = useState(false);
  /** Get-ready lead-in; the first step's interval starts when it ends. */
  const [prepping, setPrepping] = useState(true);
  const [stepStartedAt, setStepStartedAt] = useState(
    () => Date.now() + PREP_SECONDS * 1000,
  );
  const [now, setNow] = useState(() => Date.now());

  const intervalMs = settings.intervalSeconds * 1000;
  const intervalEnd = stepStartedAt + intervalMs;
  const remaining = Math.max(0, (intervalEnd - now) / 1000);
  const prepRemaining = Math.max(0, (stepStartedAt - now) / 1000);
  const overtime = !prepping && !resting && remaining <= 0;

  // The countdown voice belongs to the get-ready phase; play it as the
  // runner opens (still inside the Start tap's activation window).
  useEffect(() => {
    const countdown = createSound(COUNTDOWN_SRC);
    playSound(countdown);
    return () => countdown?.pause();
  }, []);

  // The clock tick, kept in a ref so the interval below always runs the
  // latest render's version. When the interval ends while resting, the next
  // step starts by itself — anchored to the exact boundary so steps don't
  // drift, falling back to the clock when the tab slept through it.
  const tickRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    tickRef.current = () => {
      const t = Date.now();
      setNow(t);
      if (prepping && t >= stepStartedAt) {
        setPrepping(false);
        vibrate();
        return;
      }
      if (!climb.finished && resting && t >= intervalEnd) {
        setResting(false);
        setStepStartedAt(t - intervalEnd < 3000 ? intervalEnd : t);
        vibrate();
      }
    };
  });
  useEffect(() => {
    if (!open || climb.finished) return;
    const t = setInterval(() => tickRef.current(), 250);
    return () => clearInterval(t);
  }, [open, climb.finished]);

  function startNextStep() {
    setResting(false);
    setStepStartedAt(Date.now());
  }

  /** Reps done — rest out the interval (or advance at once when it's over). */
  function done() {
    const next = completeStep(climb, settings);
    setClimb(next);
    if (next.finished) return;
    if (remaining <= 0) startNextStep();
    else setResting(true);
  }

  /** Couldn't finish the step: ladder ends; a climbing pyramid turns around. */
  function cantComplete() {
    const next = failStep(climb, type, settings);
    setClimb(next);
    if (next.finished) return;
    if (remaining <= 0) startNextStep();
    else setResting(true);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (
      !nextOpen &&
      climb.completed.length > 0 &&
      !window.confirm("Discard this run? Nothing will be recorded.")
    ) {
      return;
    }
    onOpenChange(nextOpen);
  }

  const label = GROUP_TYPE_LABELS[type];
  const total = totalReps(climb);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-center gap-2 text-center">
            {type === "pyramid" && climb.direction === "down" ? (
              <TrendingDown className="size-5 text-primary" />
            ) : (
              <TrendingUp className="size-5 text-primary" />
            )}
            {label} · {exerciseTitle}
          </DialogTitle>
        </DialogHeader>

        {climb.finished ? (
          <div className="space-y-4 py-2 text-center">
            <Flag className="mx-auto size-10 text-primary" />
            <div>
              <p className="text-3xl font-bold tabular-nums">
                {climb.completed.length} sets · {total} reps
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {climb.completed.join(" · ") || "Nothing completed"}
              </p>
            </div>
            {climb.completed.length > 0 ? (
              <div className="space-y-2">
                <Button className="w-full" size="lg" onClick={() => onRecord(climb.completed)}>
                  <Check className="size-4" /> Record as sets
                </Button>
                <Button
                  variant="ghost"
                  className="w-full text-muted-foreground"
                  onClick={() => onOpenChange(false)}
                >
                  Discard
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => onOpenChange(false)}
              >
                <X className="size-4" /> Close
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-2 text-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {prepping
                  ? "Get ready"
                  : resting
                    ? "Rest · next step"
                    : `Step ${climb.completed.length + 1}`}
              </p>
              <p
                className={cn(
                  "text-6xl font-bold tabular-nums",
                  prepping ? "text-amber-500" : "text-primary",
                )}
              >
                {prepping ? Math.ceil(prepRemaining) : climb.target}
              </p>
              <p className="text-sm text-muted-foreground">
                {prepping ? `first step: ${climb.target} reps` : "reps"}
              </p>
            </div>

            {/* Interval countdown: the next step starts when it empties. */}
            <div className="space-y-1">
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full",
                    prepping
                      ? "bg-amber-500"
                      : resting
                        ? "bg-sky-500"
                        : "bg-primary",
                  )}
                  style={{
                    width: `${
                      prepping
                        ? (prepRemaining / PREP_SECONDS) * 100
                        : (remaining / settings.intervalSeconds) * 100
                    }%`,
                    transition: "width 250ms linear",
                  }}
                />
              </div>
              <p className="text-sm tabular-nums text-muted-foreground">
                {prepping
                  ? `Starting in ${Math.ceil(prepRemaining)}s`
                  : overtime
                    ? "Interval over — finish the step when you can"
                    : resting
                      ? `Next step in ${Math.ceil(remaining)}s`
                      : `${Math.ceil(remaining)}s left in this interval`}
              </p>
            </div>

            {climb.completed.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Done so far: {climb.completed.join(" · ")} ({total} reps)
              </p>
            )}

            {prepping ? null : resting ? (
              <Button
                variant="outline"
                className="w-full"
                size="lg"
                onClick={startNextStep}
              >
                Start next step now
              </Button>
            ) : (
              <div className="space-y-2">
                <Button className="h-16 w-full text-lg" onClick={done}>
                  <Check className="size-5" /> Done — {climb.target} reps
                </Button>
                <Button
                  variant="ghost"
                  className="w-full text-muted-foreground"
                  onClick={cantComplete}
                >
                  Can&apos;t complete{" "}
                  {type === "pyramid" && climb.direction === "up"
                    ? "— climb back down"
                    : "— finish here"}
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
