import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getStore } from "@/lib/data";
import { getCachedExercises } from "@/lib/data/cached";
import { buildVolumeStats } from "@/lib/domain/volume";
import {
  exerciseNoteKey,
  sessionWorkoutDay,
  WorkoutDay,
} from "@/lib/domain/schemas";
import { WeekFocus } from "@/lib/domain/types";
import { isPro } from "@/lib/billing/entitlements";
import { WinBackPaywall } from "@/components/billing/win-back-paywall";
import { WorkoutLogger } from "@/components/workout/workout-logger";

export default async function WorkoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { sessionId } = await params;
  // The history pencil deep-links here with ?edit=1 to open straight into
  // editing a completed workout.
  const { edit } = await searchParams;
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
    if (!run) notFound();
    // Program training is a paid feature. Completed sessions stay open —
    // "your data stays" — but a lapsed subscriber can't train the program.
    if (!isPro(user) && session.status !== "completed") {
      return <WinBackPaywall userId={user.id} programId={run.programId} />;
    }
    // Summary + one extracted day — the full mesocycle never travels here.
    const [program, plan] = await Promise.all([
      store.getProgramSummary(run.programId),
      store.getProgramDay(run.programId, session.weekIndex, session.weekday),
    ]);
    if (!program) notFound();
    plannedDay = plan?.day;
    isDeload = plan?.isDeload ?? false;
    weekFocus = plan?.focus;
    title = program.name;
  } else {
    const workout = session.customWorkoutId
      ? await store.getCustomWorkout(session.customWorkoutId)
      : null;
    if (!workout) notFound();
    plannedDay = workout.day;
    title = workout.title;
  }

  if (session.status !== "planned") {
    // A recorded session is an immutable snapshot: render exactly what was
    // logged, reconstructed from its own entries. The plan (which may have
    // been edited, or no longer cover this day) is only best-effort
    // enrichment — so this also never 404s a completed workout whose plan
    // changed shape.
    plannedDay = sessionWorkoutDay(session, plannedDay);
  } else if (!plannedDay) {
    notFound();
  }

  // Only the exercises planned for this day need stats — so we fetch just the
  // completed sessions that reference them, not the athlete's whole history.
  const plannedExerciseIds = [
    ...new Set(plannedDay.exercises.map((we) => we.exerciseId)),
  ];
  const [exercises, completed, notes] = await Promise.all([
    getCachedExercises(store),
    store.listCompletedSessionsByExercises(user.id, plannedExerciseIds),
    // Only the planned exercises' remembered notes, not the whole notebook.
    store.listExerciseNotes(user.id, plannedExerciseIds),
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
      initialEditing={edit === "1"}
    />
  );
}
