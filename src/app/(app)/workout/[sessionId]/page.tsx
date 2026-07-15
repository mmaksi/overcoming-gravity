import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getStore } from "@/lib/data";
import { getCachedExercises } from "@/lib/data/cached";
import { buildVolumeStats } from "@/lib/domain/volume";
import { exerciseNoteKey, WorkoutDay } from "@/lib/domain/schemas";
import { WeekFocus } from "@/lib/domain/types";
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
  let weekFocus: WeekFocus | undefined;
  if (session.runId) {
    const run = await store.getRun(session.runId);
    const program = run ? await store.getProgram(run.programId) : null;
    if (!run || !program) notFound();
    const week = program.mesocycle.weeks[session.weekIndex];
    plannedDay = week?.days[session.weekday] ?? undefined;
    isDeload = week?.isDeload ?? false;
    weekFocus = week?.focus;
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

  // Only the exercises planned for this day need stats — so we fetch just the
  // completed sessions that reference them, not the athlete's whole history.
  const plannedExerciseIds = [
    ...new Set(plannedDay.exercises.map((we) => we.exerciseId)),
  ];
  const [exercises, completed, notes] = await Promise.all([
    getCachedExercises(store),
    store.listCompletedSessionsByExercises(user.id, plannedExerciseIds),
    store.listExerciseNotes(user.id),
  ]);

  // Stats for every progression of every planned exercise, so swapping
  // progression mid-workout still shows the right memory instantly.
  const stats = buildVolumeStats(completed.filter((s) => s.id !== session.id));
  // One remembered note per exercise progression, keyed for the logger to look
  // up by the progression actually selected. Legacy per-exercise rows (stored
  // under a sentinel progression id) simply never match a real progression.
  const userNotes: Record<string, string> = {};
  for (const n of notes) {
    userNotes[exerciseNoteKey(n.exerciseId, n.progressionId)] = n.note;
  }

  return (
    <WorkoutLogger
      session={session}
      title={title}
      plannedDay={plannedDay}
      isDeload={isDeload}
      weekFocus={weekFocus}
      exercises={exercises}
      stats={stats}
      userNotes={userNotes}
    />
  );
}
