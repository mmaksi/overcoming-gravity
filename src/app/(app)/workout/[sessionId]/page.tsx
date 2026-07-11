import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getStore } from "@/lib/data";
import { buildVolumeStats } from "@/lib/domain/volume";
import { exerciseNoteKey, WorkoutDay } from "@/lib/domain/schemas";
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

  // A session belongs to a program run or to a standalone custom workout.
  let title: string;
  let plannedDay: WorkoutDay | undefined;
  let isDeload = false;
  if (session.runId) {
    const run = await store.getRun(session.runId);
    const program = run ? await store.getProgram(run.programId) : null;
    if (!run || !program) notFound();
    const week = program.mesocycle.weeks[session.weekIndex];
    plannedDay = week?.days[session.weekday] ?? undefined;
    isDeload = week?.isDeload ?? false;
    title = program.name;
  } else {
    const workout = session.customWorkoutId
      ? await store.getCustomWorkout(session.customWorkoutId)
      : null;
    if (!workout) notFound();
    plannedDay = workout.day;
    title = workout.title;
  }
  if (!plannedDay) notFound();

  const [exercises, completed, notes] = await Promise.all([
    store.listExercises(),
    store.listCompletedSessions(user.id),
    store.listExerciseNotes(user.id),
  ]);

  // Stats for every progression of every planned exercise, so swapping
  // progression mid-workout still shows the right memory instantly.
  const stats = buildVolumeStats(completed.filter((s) => s.id !== session.id));
  const userNotes = Object.fromEntries(
    notes.map((n) => [exerciseNoteKey(n.exerciseId, n.techniqueId), n.note]),
  );

  return (
    <WorkoutLogger
      session={session}
      title={title}
      plannedDay={plannedDay}
      isDeload={isDeload}
      exercises={exercises}
      stats={stats}
      userNotes={userNotes}
    />
  );
}
