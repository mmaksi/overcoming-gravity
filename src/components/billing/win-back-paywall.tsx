import { Dumbbell, Lock, Target, TrendingUp } from "lucide-react";
import { getStore } from "@/lib/data";
import {
  getCachedExercises,
  getCachedFinishedSessions,
  getCachedUserPrograms,
} from "@/lib/data/cached";
import { Card, CardContent } from "@/components/ui/card";
import { PlanCards } from "@/components/billing/paywall";

/**
 * The paywall a lapsed subscriber sees instead of their program pages: not
 * the generic feature list but their own numbers — the exercises,
 * progressions and goals they built and are now locked out of. Rendered
 * server-side so it can read the full mesocycle; the checkout itself never
 * offers a trial here (they already had one).
 */
export async function WinBackPaywall({
  userId,
  programId,
}: {
  userId: string;
  /** The program the user was trying to open — leads the pitch. */
  programId: string;
}) {
  const store = await getStore();
  const [program, exercises, { programs }, finished] = await Promise.all([
    store.getProgram(programId),
    getCachedExercises(store),
    getCachedUserPrograms(store, userId),
    getCachedFinishedSessions(store, userId),
  ]);

  // Everything this program has planned: distinct exercises, the
  // progressions the athlete was working through, and the total set count.
  const exercisesById = new Map(exercises.map((e) => [e.id, e]));
  const exerciseIds = new Set<string>();
  const progressionNames = new Set<string>();
  let plannedSets = 0;
  for (const week of program?.mesocycle.weeks ?? []) {
    for (const day of Object.values(week.days)) {
      if (!day) continue;
      for (const we of day.exercises) {
        exerciseIds.add(we.exerciseId);
        plannedSets += we.sets.length;
        const progression = exercisesById
          .get(we.exerciseId)
          ?.progressions.find((p) => p.id === we.progressionId);
        if (progression) progressionNames.add(progression.name);
      }
    }
  }

  // Goals across every program the user built — the unfinished ones are the
  // strongest reason to come back.
  const allGoals = programs.flatMap((p) => Object.values(p.goals ?? {}).flat());
  const achievedGoals = allGoals.filter((g) => g.done);
  const openGoals = allGoals.filter((g) => !g.done);

  const workoutsDone = finished.filter((s) => s.status === "completed").length;
  const midProgressions = [...progressionNames].slice(0, 3);

  const stats: [number, string][] = [
    [exerciseIds.size, "exercises programmed"],
    [plannedSets, "sets planned for you"],
    [workoutsDone, "workouts already logged"],
    [achievedGoals.length, "goals already achieved"],
  ];

  return (
    <div className="mx-auto max-w-md space-y-5">
      <div className="space-y-2 text-center">
        <Lock className="mx-auto size-10 text-primary" />
        <h1 className="text-2xl font-bold">
          {program ? `"${program.name}" is on hold` : "Your training is on hold"}
        </h1>
        <p className="text-muted-foreground">
          Your subscription ended, so your programs are locked — but nothing
          is lost. Here&apos;s what&apos;s waiting for you:
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {stats
          .filter(([n]) => n > 0)
          .map(([n, label]) => (
            <div
              key={label}
              className="rounded-xl border bg-primary/5 p-3 text-center"
            >
              <p className="text-2xl font-bold tabular-nums text-primary">
                {n}
              </p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
      </div>

      {midProgressions.length > 0 && (
        <p className="flex items-start gap-2 text-sm">
          <TrendingUp className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>
            You were mid-progression on{" "}
            <span className="font-medium">{midProgressions.join(", ")}</span>
            {progressionNames.size > midProgressions.length
              ? ` and ${progressionNames.size - midProgressions.length} more`
              : ""}
            . Every week away, that hard-earned strength fades.
          </span>
        </p>
      )}

      {openGoals.length > 0 && (
        <div className="space-y-2 rounded-xl border p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Target className="size-4 text-primary" /> Goals you set — still
            unfinished
          </p>
          <ul className="space-y-1">
            {openGoals.slice(0, 4).map((g, i) => (
              <li
                key={`${i}-${g.text}`}
                className="flex items-start gap-2 text-sm text-muted-foreground"
              >
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                {g.text}
              </li>
            ))}
          </ul>
          {achievedGoals.length > 0 && (
            <p className="text-xs text-muted-foreground">
              You already ticked {achievedGoals.length} — don&apos;t stop
              here.
            </p>
          )}
        </div>
      )}

      {workoutsDone > 0 && (
        <p className="flex items-start gap-2 text-sm">
          <Dumbbell className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>
            {workoutsDone} workout{workoutsDone === 1 ? "" : "s"} logged —
            your history, notes and progress stay exactly where you left them
            the moment you&apos;re back.
          </span>
        </p>
      )}

      <Card>
        <CardContent>
          <PlanCards showTrial={false} showFeatures={false} />
        </CardContent>
      </Card>
    </div>
  );
}
