import Link from "next/link";
import { ArrowRight, Dumbbell, Play, Settings } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getStore } from "@/lib/data";
import {
  getCachedBodyweight,
  getCachedDashboard,
  getCachedExercises,
  getCachedFinishedSessions,
  getCachedProgramDay,
  getCachedUserPrograms,
} from "@/lib/data/cached";
import { toISODate } from "@/lib/domain/schedule";
import { workoutStreak } from "@/lib/domain/streak";
import { MEASUREMENT_UNIT, WEEKDAY_LABELS } from "@/lib/domain/types";
import {
  Exercise,
  measurementOf,
  orderDayExercises,
  SessionSummary,
  WorkoutDay,
} from "@/lib/domain/schemas";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InstallAppButton } from "@/components/home/install-app-button";
import { GoalsCard, ProgramGoals } from "@/components/home/goals-card";
import { RunCarousel } from "@/components/home/run-carousel";
import { StatsSection } from "@/components/home/stats-section";
import { UserAvatar } from "@/components/home/user-avatar";

/** The planned exercises of the upcoming session, in section order. */
function UpcomingExercises({
  day,
  session,
  exercisesById,
  isToday,
}: {
  day: WorkoutDay;
  session: SessionSummary;
  exercisesById: Map<string, Exercise>;
  isToday: boolean;
}) {
  // Same canonical order the designer and the workout logger use.
  const planned = orderDayExercises(day.exercises, exercisesById);
  if (planned.length === 0) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {isToday ? "Today" : `Up next · ${WEEKDAY_LABELS[session.weekday]}`}
      </p>
      <ul className="min-h-0 flex-1 divide-y overflow-y-auto rounded-lg border text-sm">
        {planned.map((we) => {
          const exercise = exercisesById.get(we.exerciseId);
          const progression = exercise?.progressions.find(
            (p) => p.id === we.progressionId,
          );
          const m = measurementOf(exercise, we.progressionId, we.measurement);
          const unit = m === "reps" ? "" : MEASUREMENT_UNIT[m];
          return (
            <li
              key={we.id}
              className="flex items-center justify-between gap-2 px-3 py-2"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">
                  {exercise?.title ?? "Exercise"}
                </span>
                {progression && (
                  <span className="block truncate text-xs text-muted-foreground">
                    {progression.name}
                  </span>
                )}
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {we.sets.length} × {we.sets.map((s) => s.reps).join("/")}
                {unit}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  const store = await getStore();

  // Cached until the schedule actually changes (explicit workout save,
  // run/program mutations) — the draft autosave never busts this.
  const dashboardRuns = await getCachedDashboard(store, user.id);

  if (dashboardRuns.length === 0) {
    const { programs } = await getCachedUserPrograms(store, user.id);
    return (
      <div className="flex flex-col gap-6 pt-10">
        <div className="space-y-2 text-center">
          <Dumbbell className="mx-auto size-12 text-primary" />
          <h1 className="text-2xl font-bold">Welcome, {user.name}</h1>
          <p className="text-muted-foreground">
            {programs.length === 0
              ? "Create your first calisthenics program to get started."
              : "No active program run. Start one from your programs."}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <InstallAppButton />
          <Button asChild size="lg">
            <Link href="/programs/new">
              Create a program <ArrowRight className="size-4" />
            </Link>
          </Button>
          {programs.length > 0 && (
            <Button asChild variant="outline" size="lg">
              <Link href="/programs">Programs</Link>
            </Button>
          )}
        </div>
      </div>
    );
  }

  const today = toISODate(new Date());
  // Stats are cached until a weigh-in changes in Settings; finished sessions
  // (the streak) are cached until a workout is completed/skipped/deleted;
  // program summaries (the lifetime goal count) until a program/goal changes.
  const [bodyweight, exercises, finished, { programs: allPrograms }] =
    await Promise.all([
      getCachedBodyweight(store, user.id),
      getCachedExercises(store),
      getCachedFinishedSessions(store, user.id),
      getCachedUserPrograms(store, user.id),
    ]);
  const streak = workoutStreak(finished);
  const totalWorkouts = finished.filter((s) => s.status === "completed").length;
  // Lifetime achieved goals: every ticked goal across all programs (active,
  // archived and completed alike).
  const goalsAchieved = allPrograms.reduce(
    (n, p) =>
      n +
      Object.values(p.goals ?? {})
        .flat()
        .filter((g) => g.done).length,
    0,
  );
  const exercisesById = new Map(exercises.map((e) => [e.id, e]));
  const programGoals: ProgramGoals[] = [];

  // One card per active program run — several can run in parallel (swipeable
  // carousel). Cards share a fixed height; the exercise list scrolls inside.
  const runCards = [];
  for (const { run, program, sessions } of dashboardRuns) {
    if (program?.goals) {
      programGoals.push({
        programId: program.id,
        programName: program.name,
        goals: program.goals,
      });
    }
    const todaySession = sessions.find((s) => s.date === today);
    const nextSession = sessions.find(
      (s) => s.status === "planned" && s.date >= today,
    );
    const done = sessions.filter((s) => s.status === "completed").length;
    const pct =
      sessions.length === 0 ? 0 : Math.round((done / sessions.length) * 100);

    const upcoming = todaySession ?? nextSession;
    // The one planned day the card previews — fetched on its own so the
    // dashboard cache never carries the whole mesocycle.
    const upcomingDay =
      upcoming && program
        ? await getCachedProgramDay(
            store,
            user.id,
            program.id,
            upcoming.weekIndex,
            upcoming.weekday,
          )
        : null;

    runCards.push(
      <Card
        key={run.id}
        className={`flex h-[26rem] flex-col ${todaySession ? "border-primary" : ""}`}
      >
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="truncate">{program?.name ?? "Program"}</span>
            <Badge variant="secondary" className="shrink-0">
              Week{" "}
              {todaySession
                ? todaySession.weekIndex + 1
                : (nextSession?.weekIndex ?? 0) + 1}{" "}
              of {program?.weeks ?? "?"}
            </Badge>
          </CardTitle>
          <CardDescription>
            {done} of {sessions.length} workouts completed
          </CardDescription>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="h-2 w-full shrink-0 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          {upcoming && upcomingDay && (
            <UpcomingExercises
              day={upcomingDay.day}
              session={upcoming}
              exercisesById={exercisesById}
              isToday={upcoming === todaySession}
            />
          )}
          <div className="mt-auto shrink-0">
            {todaySession ? (
              <Button asChild className="w-full" size="lg">
                <Link href={`/workout/${todaySession.id}`}>
                  <Play className="size-4" />
                  {todaySession.status === "completed"
                    ? "Review workout"
                    : todaySession.hasEntries
                      ? "Continue workout"
                      : "Start workout"}
                </Link>
              </Button>
            ) : (
              nextSession && (
                <Button asChild variant="outline" className="w-full">
                  <Link href={`/workout/${nextSession.id}`}>
                    <Play className="size-4" /> Feeling fresh? Do it today
                  </Link>
                </Button>
              )
            )}
          </div>
        </CardContent>
      </Card>,
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <UserAvatar name={user.name} avatarUrl={user.avatarUrl} />
          <h1 className="truncate text-2xl font-bold">Hi, {user.name}</h1>
        </div>
        <Link
          href="/settings"
          aria-label="Settings"
          className="-mr-2 shrink-0 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Settings className="size-6" />
        </Link>
      </div>

      <InstallAppButton />

      <RunCarousel>{runCards}</RunCarousel>

      <StatsSection
        entries={bodyweight}
        heightCm={user.heightCm}
        targetWeightKg={user.targetWeightKg}
        streak={streak}
        totalWorkouts={totalWorkouts}
        goalsAchieved={goalsAchieved}
      />

      <GoalsCard programs={programGoals} />
    </div>
  );
}
