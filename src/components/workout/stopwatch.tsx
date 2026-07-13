"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function format(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  const tenths = Math.floor((ms % 1000) / 100);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${tenths}`;
}

/**
 * Stopwatch for timing isometric holds (planks, levers…), shown as a
 * centered modal. Closing the modal stops and resets it — exiting the
 * stopwatch means you're done timing, so it never keeps ticking in the
 * background.
 */
export function Stopwatch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
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

  // Closing the modal stops the stopwatch and clears it back to zero, so it
  // never keeps ticking in the background once you've exited it.
  function handleOpenChange(next: boolean) {
    if (!next) {
      setRunning(false);
      baseRef.current = 0;
      setElapsed(0);
    }
    onOpenChange(next);
  }

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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="text-center text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Stopwatch
          </DialogTitle>
        </DialogHeader>
        <p className="py-6 text-center text-6xl font-bold tabular-nums">
          {format(elapsed)}
        </p>
        <div className="flex justify-center gap-3 pb-2">
          <Button
            size="lg"
            variant={running ? "secondary" : "default"}
            onClick={toggle}
          >
            {running ? (
              <>
                <Pause className="size-5" /> Pause
              </>
            ) : (
              <>
                <Play className="size-5" /> Start
              </>
            )}
          </Button>
          <Button size="lg" variant="outline" onClick={reset}>
            <RotateCcw className="size-5" /> Reset
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
