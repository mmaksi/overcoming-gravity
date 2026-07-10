import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getStore } from "@/lib/data";
import { buildVolumeStats } from "@/lib/domain/volume";
import { WorkoutLogger } from "@/components/workout/workout-logger";

export default async function WorkoutPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const user = await requireUser();
  const store = await getStore();

  const session = await store.getSession(sessionId);
  if (!session || session.userId !== user.id) notFound();

  const run = await store.getRun(session.runId);
  const program = run ? await store.getProgram(run.programId) : null;
  if (!run || !program) notFound();

  const week = program.mesocycle.weeks[session.weekIndex];
  const plannedDay = week?.days[session.weekday];
  if (!plannedDay) notFound();

  const [exercises, completed] = await Promise.all([
    store.listExercises(),
    store.listCompletedSessions(user.id),
  ]);

  // Stats for every progression of every planned exercise, so swapping
  // progression mid-workout still shows the right memory instantly.
  const stats = buildVolumeStats(
    completed.filter((s) => s.id !== session.id),
  );

  return (
    <WorkoutLogger
      session={session}
      program={program}
      plannedDay={plannedDay}
      isDeload={week.isDeload}
      exercises={exercises}
      stats={stats}
    />
  );
}
