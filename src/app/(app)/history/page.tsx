import { CalendarDays, TrendingUp } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getStore } from "@/lib/data";
import { buildVolumeStats, statsKey } from "@/lib/domain/volume";
import { TECHNIQUES_BY_ID, WEEKDAY_LABELS } from "@/lib/domain/types";
import { Exercise, WorkoutSession } from "@/lib/domain/schemas";
import {
  ProgressList,
  ProgressRow,
} from "@/components/history/progress-list";
import { WorkoutHistoryList } from "@/components/history/workout-history-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** "Intra" or the inter-exercise technique's name — what to do next time. */
function methodLabel(interTechniqueId?: string): string {
  if (!interTechniqueId) return "Intra";
  return TECHNIQUES_BY_ID.get(interTechniqueId)?.name ?? "Inter";
}

function entryLabel(
  session: WorkoutSession,
  exercisesById: Map<string, Exercise>,
) {
  // Unfilled exercises are skipped on completion — nothing to show for them.
  return session.entries
    .filter((entry) => entry.performedSets.length > 0)
    .map((entry) => {
    const ex = exercisesById.get(entry.exerciseId);
    const progression = ex?.progressions.find(
      (p) => p.id === entry.progressionId,
    );
    const unit = ex?.measurement === "time" ? "s" : "";
    const progressionName = (id: string) =>
      ex?.progressions.find((p) => p.id === id)?.name ?? "?";
    const values = entry.performedSets
      .map((s) => {
        // Hybrid sets: show the per-progression breakdown of the set.
        if (s.parts && s.parts.length > 0) {
          return s.parts
            .map((p) => `${p.reps} ${progressionName(p.progressionId)}`)
            .join(" + ");
        }
        return s.eccentricReps !== undefined
          ? `${s.reps ?? "—"}+${s.eccentricReps}ecc`
          : `${s.reps ?? "—"}`;
      })
      .join("/");
    return {
      id: `${session.id}-${entry.workoutExerciseId}`,
      title: ex?.title ?? "Unknown exercise",
      detail: `${progression?.name ?? ""} · ${entry.performedSets.length}×${values}${unit}`,
      method: methodLabel(entry.interTechniqueId),
      isInter: !!entry.interTechniqueId,
      notes: entry.notes,
    };
  });
}

export default async function HistoryPage() {
  const user = await requireUser();
  const store = await getStore();

  const [completed, exercises, programs, runs, customWorkouts] =
    await Promise.all([
      store.listCompletedSessions(user.id),
      store.listExercises(),
      store.listPrograms(user.id),
      store.listRuns(user.id),
      store.listCustomWorkouts(user.id),
    ]);

  const exercisesById = new Map(exercises.map((e) => [e.id, e]));
  const programNameByRun = new Map(
    runs.map((r) => [
      r.id,
      programs.find((p) => p.id === r.programId)?.name ?? "Program",
    ]),
  );
  const customWorkoutTitles = new Map(
    customWorkouts.map((w) => [w.id, w.title]),
  );
  const sessionLabel = (session: WorkoutSession): string =>
    session.runId
      ? (programNameByRun.get(session.runId) ?? "Program")
      : (customWorkoutTitles.get(session.customWorkoutId ?? "") ?? "Workout");

  const stats = buildVolumeStats(completed);
  // Current progression + progression method per exercise = the one used in
  // the newest completed entry (sessions are newest-first).
  const currentProgression = new Map<string, string>();
  const currentMethod = new Map<string, string | undefined>();
  for (const session of completed) {
    for (const entry of session.entries) {
      if (!currentProgression.has(entry.exerciseId)) {
        currentProgression.set(entry.exerciseId, entry.progressionId);
        currentMethod.set(entry.exerciseId, entry.interTechniqueId);
      }
    }
  }

  // Progress overview covers only the skill and strength sections.
  const progressRows: ProgressRow[] = exercises
    .filter((e) => e.attribute === "skill" || e.attribute === "strength")
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((ex) => {
      const progressionId = currentProgression.get(ex.id);
      const progression = progressionId
        ? ex.progressions.find((p) => p.id === progressionId)
        : undefined;
      const best = progressionId
        ? stats[statsKey(ex.id, progressionId)]?.maxReps
        : undefined;
      const step = progression
        ? ex.progressions.findIndex((p) => p.id === progression.id) + 1
        : 0;
      return {
        exerciseId: ex.id,
        title: ex.title,
        attribute: ex.attribute as "skill" | "strength",
        detail: progression
          ? `${progression.name} · best ${best ?? "—"}${ex.measurement === "time" ? "s" : " reps"} · ${methodLabel(currentMethod.get(ex.id))}`
          : "Not trained yet",
        step,
        totalSteps: ex.progressions.length,
      };
    });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">History</h1>

      <Tabs defaultValue="workouts">
        <TabsList className="w-full">
          <TabsTrigger value="workouts" className="flex-1">
            <CalendarDays className="size-4" /> Workouts
          </TabsTrigger>
          <TabsTrigger value="progress" className="flex-1">
            <TrendingUp className="size-4" /> Progress
          </TabsTrigger>
        </TabsList>

        <TabsContent value="workouts" className="space-y-8 pt-3">
          <WorkoutHistoryList
            sessions={completed.map((session) => ({
              id: session.id,
              date: session.date,
              label: sessionLabel(session),
              meta: `${WEEKDAY_LABELS[session.weekday]}, week ${session.weekIndex + 1} · ${session.entries.length} exercises`,
              lines: entryLabel(session, exercisesById),
            }))}
          />
        </TabsContent>

        <TabsContent value="progress" className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            Your current progression, method and best set in every skill and
            strength exercise — so you know exactly what to do next workout.
          </p>
          <ProgressList rows={progressRows} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
