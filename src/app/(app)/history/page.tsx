import Link from "next/link";
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
import { Badge } from "@/components/ui/badge";
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

  const [completed, exercises, programs, runs] = await Promise.all([
    store.listCompletedSessions(user.id),
    store.listExercises(),
    store.listPrograms(user.id),
    store.listRuns(user.id),
  ]);

  const exercisesById = new Map(exercises.map((e) => [e.id, e]));
  const programNameByRun = new Map(
    runs.map((r) => [
      r.id,
      programs.find((p) => p.id === r.programId)?.name ?? "Program",
    ]),
  );

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
          {completed.length === 0 && (
            <div className="space-y-1 py-8 text-center">
              <p className="font-medium">No workouts yet</p>
              <p className="text-sm text-muted-foreground">
                Completed workouts appear here with everything you logged.
              </p>
            </div>
          )}
          {completed.map((session) => (
            <Link
              key={session.id}
              href={`/workout/${session.id}`}
              className="block space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">{session.date}</span>
                <Badge variant="secondary">
                  {programNameByRun.get(session.runId)}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {WEEKDAY_LABELS[session.weekday]}, week {session.weekIndex + 1}{" "}
                · {session.entries.length} exercises
              </p>
              <div className="space-y-1.5">
                {entryLabel(session, exercisesById).map((line) => (
                  <div key={line.id} className="text-sm text-muted-foreground">
                    <p className="flex items-center gap-1.5">
                      <span className="font-medium text-foreground">
                        {line.title}
                      </span>{" "}
                      {line.detail}
                      <Badge
                        variant={line.isInter ? "default" : "outline"}
                        className="ml-auto shrink-0 text-[10px]"
                      >
                        {line.method}
                      </Badge>
                    </p>
                    {line.notes && <p className="pl-2 italic">“{line.notes}”</p>}
                  </div>
                ))}
              </div>
            </Link>
          ))}
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
