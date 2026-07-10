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

export default async function DashboardPage() {
  const user = await requireUser();
  const store = await getStore();

  const runs = await store.listRuns(user.id);
  const activeRun = runs.find((r) => r.status === "active");

  if (!activeRun) {
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

  const program = await store.getProgram(activeRun.programId);
  const sessions = await store.listSessionsByRun(activeRun.id);
  const today = toISODate(new Date());
  const todaySession = sessions.find((s) => s.date === today);
  const nextSession = sessions.find(
    (s) => s.status === "planned" && s.date >= today,
  );
  const done = sessions.filter((s) => s.status === "completed").length;
  const pct =
    sessions.length === 0 ? 0 : Math.round((done / sessions.length) * 100);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Hi, {user.name}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            {program?.name ?? "Program"}
            <Badge variant="secondary">
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
        <CardContent>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {todaySession ? (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle>Today&apos;s workout</CardTitle>
            <CardDescription>
              {WEEKDAY_LABELS[todaySession.weekday]}, week{" "}
              {todaySession.weekIndex + 1}
              {todaySession.status === "completed" && " — completed 🎉"}
            </CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Rest day</CardTitle>
            <CardDescription>
              {nextSession
                ? `Next workout: ${WEEKDAY_LABELS[nextSession.weekday]} ${nextSession.date}`
                : "No upcoming workouts in this run."}
            </CardDescription>
          </CardHeader>
          {nextSession && (
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href={`/workout/${nextSession.id}`}>
                  <Play className="size-4" /> Feeling fresh? Do it today
                </Link>
              </Button>
            </CardContent>
          )}
        </Card>
      )}

      <Button asChild variant="outline" className="w-full">
        <Link href="/calendar">
          <CalendarDays className="size-4" /> View calendar
        </Link>
      </Button>
    </div>
  );
}
