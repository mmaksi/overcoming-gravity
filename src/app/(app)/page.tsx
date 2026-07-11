import Link from "next/link";
import { ArrowRight, CalendarDays, Dumbbell, Play } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getStore } from "@/lib/data";
import { toISODate } from "@/lib/domain/schedule";
import { WEEKDAY_LABELS } from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GoalsCard, ProgramGoals } from "@/components/home/goals-card";

export default async function DashboardPage() {
  const user = await requireUser();
  const store = await getStore();

  const runs = await store.listRuns(user.id);
  const activeRuns = runs.filter((r) => r.status === "active");

  if (activeRuns.length === 0) {
    const programs = await store.listPrograms(user.id);
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
          <Button asChild size="lg">
            <Link href="/programs/new">
              Create a program <ArrowRight className="size-4" />
            </Link>
          </Button>
          {programs.length > 0 && (
            <Button asChild variant="outline" size="lg">
              <Link href="/programs">My programs</Link>
            </Button>
          )}
        </div>
      </div>
    );
  }

  const today = toISODate(new Date());
  const programGoals: ProgramGoals[] = [];

  // One card per active program run — several can run in parallel.
  const runCards = [];
  for (const run of activeRuns) {
    const program = await store.getProgram(run.programId);
    const sessions = await store.listSessionsByRun(run.id);
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

    runCards.push(
      <Card key={run.id} className={todaySession ? "border-primary" : undefined}>
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
            {todaySession
              ? ` · today: ${WEEKDAY_LABELS[todaySession.weekday]}`
              : nextSession
                ? ` · next: ${WEEKDAY_LABELS[nextSession.weekday]} ${nextSession.date}`
                : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          {todaySession ? (
            <Button asChild className="w-full" size="lg">
              <Link href={`/workout/${todaySession.id}`}>
                <Play className="size-4" />
                {todaySession.status === "completed"
                  ? "Review workout"
                  : todaySession.entries.length > 0
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
        </CardContent>
      </Card>,
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Hi, {user.name}</h1>

      {runCards}

      <GoalsCard programs={programGoals} />

      <Button asChild variant="outline" className="w-full">
        <Link href="/calendar">
          <CalendarDays className="size-4" /> View calendar
        </Link>
      </Button>
    </div>
  );
}
