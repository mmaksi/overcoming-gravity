"use client";

import { useEffect, useRef, useState } from "react";
import { Timer, X } from "lucide-react";

export type RestTimerState = {
  /** Bumped on every start; the bar remounts via `key` so state resets. */
  id: number;
  seconds: number;
  /** What to do when the rest is over, e.g. "Set 3 · Pull-up". */
  nextLabel: string;
  /** Epoch ms the rest began — lets it resume after navigating away. */
  startedAt: number;
};

/** Epoch ms this rest period is due to be over. */
export function restEndsAt(timer: RestTimerState): number {
  return timer.startedAt + timer.seconds * 1000;
}

/**
 * Rest-countdown card: a progress bar draining over the rest period, the
 * seconds left, and what comes next. This card is the in-app half of a rest;
 * the alert itself is the caller's job, fired from `onOver` — which is why
 * this component keeps ticking while the app is in the background, and why
 * the caller works to keep the page alive there. Render with `key={timer.id}`
 * so a new rest period starts a fresh countdown; the caller positions it
 * (fixed stack above the nav).
 */
export function RestTimer({
  seconds,
  nextLabel,
  startedAt: startedAtProp,
  onOver,
  onDismiss,
}: {
  seconds: number;
  nextLabel: string;
  /** When the rest began; defaults to now. Set it to resume a running rest. */
  startedAt?: number;
  /** The countdown reached zero — fired once per rest period. */
  onOver?: () => void;
  onDismiss: () => void;
}) {
  const [startedAt] = useState(() => startedAtProp ?? Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, []);

  const elapsed = (now - startedAt) / 1000;
  const remaining = Math.max(0, seconds - elapsed);
  const fraction = seconds === 0 ? 0 : remaining / seconds;
  const over = remaining <= 0;

  // The zero crossing, announced exactly once. The ref (not the effect deps)
  // is what guarantees "once": the card remounts per rest via `key`, so a
  // fresh ref per period is the whole bookkeeping needed, and `onOver` may
  // change identity between renders without re-alerting.
  const announced = useRef(false);
  useEffect(() => {
    if (!over || announced.current) return;
    announced.current = true;
    onOver?.();
  }, [over, onOver]);

  useEffect(() => {
    if (!over) return;
    // Give the athlete a moment to see "Go!", then get out of the way.
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [over, onDismiss]);

  return (
    <div className="space-y-2 rounded-2xl border bg-background/95 p-4 shadow-lg backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 font-medium">
          <Timer className="size-5 shrink-0 text-primary" />
          {over ? (
            <span className="text-primary">Go! {nextLabel}</span>
          ) : (
            <span className="truncate">Rest · next: {nextLabel}</span>
          )}
        </span>
        <span className="flex items-center gap-2">
          {!over && (
            <span className="text-lg font-bold tabular-nums">
              {Math.ceil(remaining)}s
            </span>
          )}
          <button
            type="button"
            aria-label="Dismiss timer"
            className="p-1 text-muted-foreground hover:text-foreground"
            onClick={onDismiss}
          >
            <X className="size-5" />
          </button>
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{
            width: `${fraction * 100}%`,
            transition: "width 250ms linear",
          }}
        />
      </div>
    </div>
  );
}
