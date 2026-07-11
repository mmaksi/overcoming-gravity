"use client";

import { useEffect, useRef, useState } from "react";
import { Timer, X } from "lucide-react";

export type RestTimerState = {
  /** Bumped on every start; the bar remounts via `key` so state resets. */
  id: number;
  seconds: number;
  /** What to do when the rest is over, e.g. "Set 3 · Pull-up". */
  nextLabel: string;
};

/**
 * Fixed rest-countdown bar above the bottom nav: a progress bar draining
 * over the rest period, the seconds left, and what comes next. Fires a
 * browser notification when the rest is over (permission is requested by
 * the caller when the set is checked). Render with `key={timer.id}` so a
 * new rest period starts a fresh countdown.
 */
export function RestTimer({
  seconds,
  nextLabel,
  onDismiss,
}: {
  seconds: number;
  nextLabel: string;
  onDismiss: () => void;
}) {
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(startedAt);
  const notifiedRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, []);

  const elapsed = (now - startedAt) / 1000;
  const remaining = Math.max(0, seconds - elapsed);
  const fraction = seconds === 0 ? 0 : remaining / seconds;
  const over = remaining <= 0;

  useEffect(() => {
    if (!over || notifiedRef.current) return;
    notifiedRef.current = true;
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "granted"
    ) {
      try {
        new Notification("Rest over 💪", { body: nextLabel });
      } catch {
        // Some mobile browsers only allow notifications via a service worker.
      }
    }
    // Give the athlete a moment to see "Go!", then get out of the way.
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [over, nextLabel, onDismiss]);

  return (
    <div
      className="fixed inset-x-0 z-40"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 76px)" }}
    >
      <div className="mx-auto max-w-lg px-4">
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
      </div>
    </div>
  );
}
