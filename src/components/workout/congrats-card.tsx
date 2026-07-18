"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Flame, Trophy } from "lucide-react";

const REDIRECT_AFTER_SECONDS = 8;

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.round((totalSeconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

/**
 * Full-screen congratulations after completing a workout. A streak of 2+
 * means the athlete was already on a streak before today — celebrate it.
 * Redirects home on its own so the flow keeps moving without a tap.
 */
export function CongratsCard({
  name,
  streak,
  totalWorkouts,
  durationSeconds,
}: {
  name: string;
  streak: number;
  totalWorkouts: number;
  durationSeconds?: number;
}) {
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_AFTER_SECONDS);

  useEffect(() => {
    const interval = setInterval(
      () => setSecondsLeft((s) => Math.max(0, s - 1)),
      1000,
    );
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    if (secondsLeft === 0) router.replace("/");
  }, [secondsLeft, router]);

  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-6 text-center">
      <div className="flex size-20 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Trophy className="size-10" />
      </div>

      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Congratulations, {name}!</h1>
        <p className="text-muted-foreground">
          Workout complete
          {durationSeconds ? ` in ${formatDuration(durationSeconds)}` : ""}
          {" — that's "}
          {totalWorkouts} workout{totalWorkouts === 1 ? "" : "s"} logged.
          Strength is built one session at a time.
        </p>
      </div>

      {streak >= 2 && (
        <div className="flex items-center gap-3 rounded-2xl bg-orange-500/10 px-6 py-4">
          <Flame className="size-8 text-orange-500" />
          <div className="text-left">
            <p className="text-2xl font-bold tabular-nums">{streak} workouts</p>
            <p className="text-sm text-muted-foreground">
              You&apos;re on a streak — keep it burning!
            </p>
          </div>
        </div>
      )}

      <div className="w-full max-w-xs space-y-2">
        <Link
          href="/"
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Back to home <ArrowRight className="size-4" />
        </Link>
        <p className="text-xs text-muted-foreground">
          Taking you home in {secondsLeft}s…
        </p>
      </div>
    </div>
  );
}
