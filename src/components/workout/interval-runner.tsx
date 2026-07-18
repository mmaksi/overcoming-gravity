"use client";

import { useEffect, useRef, useState } from "react";
import { Flag, X, Zap } from "lucide-react";
import { GROUP_TYPE_LABELS } from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  IntervalPhase,
  IntervalSettings,
  phaseAt,
  PREP_SECONDS,
  totalSeconds,
} from "./interval";
import {
  COUNTDOWN_SRC,
  createSound,
  playSound,
  START_BEEP_SRC,
  unlockSound,
} from "./sounds";
import { cn } from "@/lib/utils";

/** Best-effort haptic tick on a phase change. */
function vibrate() {
  try {
    navigator.vibrate?.([180, 80, 180]);
  } catch {
    // Unsupported — the visual change is enough.
  }
}

/** "4 min" for whole minutes, "3.5 min" otherwise. */
function minutesLabel(seconds: number): string {
  const min = seconds / 60;
  return `${Number.isInteger(min) ? min : min.toFixed(1)} min`;
}

/**
 * Runs a HIIT or Tabata block live: a get-ready countdown (with its
 * "4… 3… 2… 1" sound), then work/rest rounds driven purely by the clock —
 * so waking up from a backgrounded tab lands on the right round. The start
 * beep marks both edges of every work interval — except the very first
 * start, where the countdown sound already ends in its own go cue. With
 * several exercises in the group, the rounds rotate through them in order.
 * Nothing is recorded; the athlete logs their sets as usual afterwards.
 *
 * Mount with a fresh `key` per opening — the run starts immediately.
 */
export function IntervalRunner({
  open,
  onOpenChange,
  type,
  exerciseTitles,
  settings,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "hiit" | "tabata";
  /** The group's exercises in planned order; rounds rotate through them. */
  exerciseTitles: string[];
  settings: IntervalSettings;
}) {
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(startedAt);

  const phase = phaseAt((now - startedAt) / 1000, settings);
  const finished = phase.kind === "finished";

  // Both sounds are created (and the beep unlocked) while the Start tap's
  // activation is still fresh, so the timer-driven beeps later are allowed.
  const beepRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const countdown = createSound(COUNTDOWN_SRC);
    playSound(countdown);
    const beep = createSound(START_BEEP_SRC);
    unlockSound(beep);
    beepRef.current = beep;
    return () => {
      countdown?.pause();
      beep?.pause();
    };
  }, []);

  // Phase transitions are detected on the tick (not derived in render) so
  // each one fires its cue exactly once. The beep marks both edges of a
  // work interval; the first work start is silent because the get-ready
  // countdown already ends in its own go cue.
  const lastPhaseRef = useRef<string>("prep");
  const tickRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    tickRef.current = () => {
      const t = Date.now();
      setNow(t);
      const next = phaseAt((t - startedAt) / 1000, settings);
      const id = next.kind === "prep" || next.kind === "finished"
        ? next.kind
        : `${next.kind}-${next.round}`;
      const prev = lastPhaseRef.current;
      if (id !== prev) {
        lastPhaseRef.current = id;
        vibrate();
        const workStarts = next.kind === "work" && prev !== "prep";
        const workEnds = prev.startsWith("work");
        if (workStarts || workEnds) playSound(beepRef.current);
      }
    };
  });
  useEffect(() => {
    if (!open || finished) return;
    const t = setInterval(() => tickRef.current(), 250);
    return () => clearInterval(t);
  }, [open, finished]);

  function handleOpenChange(nextOpen: boolean) {
    if (
      !nextOpen &&
      !finished &&
      phase.kind !== "prep" &&
      !window.confirm(`Stop this ${GROUP_TYPE_LABELS[type]} run?`)
    ) {
      return;
    }
    onOpenChange(nextOpen);
  }

  /** The exercise a given 1-based round belongs to. */
  function exerciseForRound(round: number): string {
    return exerciseTitles[(round - 1) % exerciseTitles.length] ?? "";
  }

  const label = GROUP_TYPE_LABELS[type];
  const total = totalSeconds(settings);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-center gap-2 text-center">
            <Zap className="size-5 text-primary" />
            {label} · {settings.workSeconds}s/{settings.restSeconds}s ×{" "}
            {settings.rounds}
          </DialogTitle>
        </DialogHeader>

        {finished ? (
          <div className="space-y-4 py-2 text-center">
            <Flag className="mx-auto size-10 text-primary" />
            <div>
              <p className="text-3xl font-bold tabular-nums">
                {settings.rounds} rounds · {minutesLabel(total)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Done — log how it went in the sets below.
              </p>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => onOpenChange(false)}
            >
              <X className="size-4" /> Close
            </Button>
          </div>
        ) : (
          <RunningPhase
            phase={phase}
            settings={settings}
            exerciseForRound={exerciseForRound}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RunningPhase({
  phase,
  settings,
  exerciseForRound,
}: {
  phase: Exclude<IntervalPhase, { kind: "finished" }>;
  settings: IntervalSettings;
  exerciseForRound: (round: number) => string;
}) {
  const phaseTotal =
    phase.kind === "prep"
      ? PREP_SECONDS
      : phase.kind === "work"
        ? settings.workSeconds
        : settings.restSeconds;
  const isLastRest =
    phase.kind === "rest" && phase.round === settings.rounds;
  const upNext =
    phase.kind === "prep"
      ? exerciseForRound(1)
      : phase.kind === "rest" && !isLastRest
        ? exerciseForRound(phase.round + 1)
        : null;

  return (
    <div className="space-y-4 py-2 text-center">
      <div>
        <p
          className={cn(
            "text-sm font-semibold uppercase tracking-wide",
            phase.kind === "work" ? "text-primary" : "text-muted-foreground",
          )}
        >
          {phase.kind === "prep"
            ? "Get ready"
            : phase.kind === "work"
              ? `Work · ${exerciseForRound(phase.round)}`
              : isLastRest
                ? "Rest · last one, almost done"
                : "Rest"}
        </p>
        <p
          className={cn(
            "text-6xl font-bold tabular-nums",
            phase.kind === "prep"
              ? "text-amber-500"
              : phase.kind === "work"
                ? "text-primary"
                : "text-sky-500",
          )}
        >
          {Math.ceil(phase.secondsLeft)}
        </p>
        <p className="text-sm text-muted-foreground">
          {upNext ? `up next: ${upNext}` : "seconds"}
        </p>
      </div>

      <div className="space-y-1">
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full",
              phase.kind === "prep"
                ? "bg-amber-500"
                : phase.kind === "work"
                  ? "bg-primary"
                  : "bg-sky-500",
            )}
            style={{
              width: `${(phase.secondsLeft / phaseTotal) * 100}%`,
              transition: "width 250ms linear",
            }}
          />
        </div>
        <p className="text-sm tabular-nums text-muted-foreground">
          {phase.kind === "prep"
            ? `Starting in ${Math.ceil(phase.secondsLeft)}s`
            : `Round ${phase.round} of ${settings.rounds}`}
        </p>
      </div>
    </div>
  );
}
