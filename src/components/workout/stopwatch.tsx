"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

function format(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  const tenths = Math.floor((ms % 1000) / 100);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${tenths}`;
}

/**
 * Simple stopwatch card for timing isometric holds (planks, levers…).
 * The caller positions it (fixed stack above the nav).
 */
export function Stopwatch({ onClose }: { onClose: () => void }) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const baseRef = useRef(0); // elapsed ms accumulated before the last start
  const startRef = useRef(0); // timestamp of the last start

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(
      () => setElapsed(baseRef.current + (Date.now() - startRef.current)),
      100,
    );
    return () => clearInterval(interval);
  }, [running]);

  function toggle() {
    if (running) {
      baseRef.current = baseRef.current + (Date.now() - startRef.current);
      setElapsed(baseRef.current);
      setRunning(false);
    } else {
      startRef.current = Date.now();
      setRunning(true);
    }
  }

  function reset() {
    baseRef.current = 0;
    startRef.current = Date.now();
    setElapsed(0);
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border bg-background/95 p-4 shadow-lg backdrop-blur">
      <span className="text-2xl font-bold tabular-nums">{format(elapsed)}</span>
      <span className="flex items-center gap-1.5">
        <Button
          size="icon"
          variant={running ? "secondary" : "default"}
          aria-label={running ? "Pause stopwatch" : "Start stopwatch"}
          onClick={toggle}
        >
          {running ? <Pause className="size-5" /> : <Play className="size-5" />}
        </Button>
        <Button
          size="icon"
          variant="outline"
          aria-label="Reset stopwatch"
          onClick={reset}
        >
          <RotateCcw className="size-5" />
        </Button>
        <button
          type="button"
          aria-label="Close stopwatch"
          className="p-1 text-muted-foreground hover:text-foreground"
          onClick={onClose}
        >
          <X className="size-5" />
        </button>
      </span>
    </div>
  );
}
