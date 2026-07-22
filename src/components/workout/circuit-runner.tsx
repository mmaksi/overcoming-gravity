"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Flag, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PREP_SECONDS } from "./interval";
import { CircuitStation } from "./mode-settings-dialog";
import {
  COUNTDOWN_SRC,
  createSound,
  playSound,
  START_BEEP_SRC,
  unlockSound,
  vibrate,
} from "./sounds";

export type CircuitSettings = {
  rounds: number;
  /** One station per exercise in the group, in planned order. */
  stations: CircuitStation[];
};

/**
 * Runs a circuit live: a get-ready countdown (with its "4… 3… 2… 1" sound),
 * then `rounds` passes over the group's exercises in order. Seconds stations
 * count down and advance on the clock; reps stations wait for the athlete's
 * tap. The start beep marks every switch to the next exercise — except the
 * very first station, where the countdown sound already ends in its own go
 * cue. On a full finish `onComplete` fires once so the logger can auto-fill
 * each exercise's sets; stopping early records nothing.
 *
 * Mount with a fresh `key` per opening — the run starts immediately.
 */
export function CircuitRunner({
  open,
  onOpenChange,
  exerciseTitles,
  settings,
  onComplete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The group's exercises in planned order — one station each. */
  exerciseTitles: string[];
  settings: CircuitSettings;
  /** Fired once when every round is done — never on an early stop. */
  onComplete: () => void;
}) {
  const perRound = Math.max(1, settings.stations.length);
  const totalStations = settings.rounds * perRound;

  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(startedAt);
  /** Index into the flat rounds × exercises sequence; == total when done. */
  const [index, setIndex] = useState(0);
  /** When the current station began (the first starts as prep ends). */
  const [stationStartedAt, setStationStartedAt] = useState(
    startedAt + PREP_SECONDS * 1000,
  );

  const prepLeft = (startedAt + PREP_SECONDS * 1000 - now) / 1000;
  const inPrep = prepLeft > 0;
  const finished = index >= totalStations;

  const station = settings.stations[index % perRound];
  const round = Math.floor(index / perRound) + 1;
  const title = (i: number) => exerciseTitles[i % perRound] ?? "Exercise";

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

  // Auto-log exactly once, the moment the last station clears. The ref guards
  // against the effect re-running (finished stays true, onComplete identity
  // changes) so sets are only filled a single time.
  const recordedRef = useRef(false);
  useEffect(() => {
    if (finished && !recordedRef.current) {
      recordedRef.current = true;
      onComplete();
    }
  }, [finished, onComplete]);

  /** Move to the next station (tap on reps, clock on seconds). */
  function advance() {
    vibrate();
    playSound(beepRef.current);
    setIndex((i) => i + 1);
    setStationStartedAt(Date.now());
  }

  // The tick drives the clock display and auto-advances seconds stations.
  // Kept in a ref so the interval always sees fresh state.
  const tickRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    tickRef.current = () => {
      const t = Date.now();
      setNow(t);
      if (finished || inPrep || !station || station.mode !== "seconds") return;
      if ((t - stationStartedAt) / 1000 >= station.amount) advance();
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
      !inPrep &&
      !window.confirm("Stop this circuit run?")
    ) {
      return;
    }
    onOpenChange(nextOpen);
  }

  const secondsLeft =
    station?.mode === "seconds"
      ? Math.max(0, station.amount - (now - stationStartedAt) / 1000)
      : 0;
  const isLastStation = index === totalStations - 1;
  const upNext = !finished && !isLastStation ? title(index + 1) : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-center gap-2 text-center">
            <RefreshCw className="size-5 text-primary" />
            Circuit · {settings.rounds} × {perRound} exercises
          </DialogTitle>
        </DialogHeader>

        {finished ? (
          <div className="space-y-4 py-2 text-center">
            <Flag className="mx-auto size-10 text-primary" />
            <div>
              <p className="text-3xl font-bold tabular-nums">
                {settings.rounds} rounds done
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Logged to your sets below — tweak any that differed.
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
        ) : inPrep ? (
          <div className="space-y-4 py-2 text-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Get ready
              </p>
              <p className="text-6xl font-bold tabular-nums text-amber-500">
                {Math.ceil(prepLeft)}
              </p>
              <p className="text-sm text-muted-foreground">
                up next: {title(0)}
              </p>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-amber-500"
                style={{
                  width: `${(prepLeft / PREP_SECONDS) * 100}%`,
                  transition: "width 250ms linear",
                }}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2 text-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-primary">
                {title(index)}
              </p>
              {station.mode === "seconds" ? (
                <>
                  <p className="text-6xl font-bold tabular-nums text-primary">
                    {Math.ceil(secondsLeft)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {upNext ? `up next: ${upNext}` : "seconds — last one"}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-6xl font-bold tabular-nums text-primary">
                    {station.amount}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    reps{upNext ? ` · up next: ${upNext}` : " — last one"}
                  </p>
                </>
              )}
            </div>

            {station.mode === "seconds" ? (
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{
                    width: `${(secondsLeft / station.amount) * 100}%`,
                    transition: "width 250ms linear",
                  }}
                />
              </div>
            ) : (
              <Button className="w-full" size="lg" onClick={advance}>
                {isLastStation ? (
                  <>
                    <Flag className="size-4" /> Finish
                  </>
                ) : (
                  <>
                    <ArrowRight className="size-4" /> Done — next exercise
                  </>
                )}
              </Button>
            )}

            <p className="text-sm tabular-nums text-muted-foreground">
              Round {round} of {settings.rounds} · exercise{" "}
              {(index % perRound) + 1} of {perRound}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
