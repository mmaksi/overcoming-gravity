import {
  CustomWorkoutSummary,
  Exercise,
  measurementOf,
  ProgramRun,
  ProgramSummary,
  VolumeStats,
  WorkoutSession,
} from "@/lib/domain/schemas";
import {
  MEASUREMENT_UNIT,
  TECHNIQUES_BY_ID,
  WEEKDAY_LABELS,
} from "@/lib/domain/types";
import { statsKey } from "@/lib/domain/volume";
import type { ProgressRow } from "@/components/history/progress-list";

/** Workouts fetched per history page (first render + each scroll load). */
export const HISTORY_PAGE_SIZE = 3;

export type HistoryLine = {
  id: string;
  title: string;
  /** Compact sets summary, e.g. "3 × 8/8/6". */
  sets: string;
  /** Inter-exercise technique name; shown only when it's not plain "intra". */
  method?: string;
};

export type HistoryItem = {
  id: string;
  date: string;
  label: string;
  meta: string;
  /** Formatted workout duration (e.g. "42:10"), if recorded. */
  duration?: string;
  /** Total reps logged on push / pull movements. */
  pushVolume: number;
  pullVolume: number;
  lines: HistoryLine[];
};

/** What to call a session in history: its program or custom-workout name. */
export function makeSessionLabel(
  programs: ProgramSummary[],
  runs: ProgramRun[],
  customWorkouts: CustomWorkoutSummary[],
): (session: WorkoutSession) => string {
  const programNameByRun = new Map(
    runs.map((r) => [
      r.id,
      programs.find((p) => p.id === r.programId)?.name ?? "Program",
    ]),
  );
  const customWorkoutTitles = new Map(
    customWorkouts.map((w) => [w.id, w.title]),
  );
  return (session) =>
    session.runId
      ? (programNameByRun.get(session.runId) ?? "Program")
      : (customWorkoutTitles.get(session.customWorkoutId ?? "") ?? "Workout");
}

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Total reps logged in a set (hybrid parts already fold into `reps`). */
function repsOf(set: { reps: number | null }): number {
  return set.reps ?? 0;
}

/**
 * Build the compact history cards: a stats strip (duration + push/pull volume)
 * and a table of exercises. Notes are intentionally dropped, and the technique
 * badge only appears for inter-exercise techniques (plain "intra" is hidden).
 */
export function buildHistoryItems(
  sessions: WorkoutSession[],
  exercisesById: Map<string, Exercise>,
  sessionLabel: (s: WorkoutSession) => string,
): HistoryItem[] {
  return sessions.map((session) => {
    let pushVolume = 0;
    let pullVolume = 0;
    const lines: HistoryLine[] = [];

    for (const entry of session.entries) {
      if (entry.performedSets.length === 0) continue;
      const ex = exercisesById.get(entry.exerciseId);
      const m = measurementOf(ex, entry.progressionId, entry.measurement);
      const unit = m === "reps" ? "" : MEASUREMENT_UNIT[m];
      const progressionName = (id: string) =>
        ex?.progressions.find((p) => p.id === id)?.name ?? "?";
      const progression = ex?.progressions.find(
        (p) => p.id === entry.progressionId,
      );

      const totalReps = entry.performedSets.reduce((n, s) => n + repsOf(s), 0);
      if (ex?.category === "push" || ex?.category === "both") {
        pushVolume += totalReps;
      }
      if (ex?.category === "pull" || ex?.category === "both") {
        pullVolume += totalReps;
      }

      const values = entry.performedSets
        .map((s) => {
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

      const technique = entry.interTechniqueId
        ? TECHNIQUES_BY_ID.get(entry.interTechniqueId)?.name
        : undefined;

      lines.push({
        id: `${session.id}-${entry.workoutExerciseId}`,
        title: ex?.title ?? "Unknown exercise",
        sets: `${progression ? `${progression.name} · ` : ""}${entry.performedSets.length} × ${values}${unit}`,
        method: technique,
      });
    }

    return {
      id: session.id,
      date: session.date,
      label: sessionLabel(session),
      meta: `${WEEKDAY_LABELS[session.weekday]}, week ${session.weekIndex + 1} · ${lines.length} exercises`,
      duration:
        session.durationSeconds != null
          ? formatDuration(session.durationSeconds)
          : undefined,
      pushVolume,
      pullVolume,
      lines,
    };
  });
}

/** Unit suffix for a "best" value: " reps" | "s" | "min". */
function bestUnit(m: ReturnType<typeof measurementOf>): string {
  return m === "reps" ? " reps" : MEASUREMENT_UNIT[m];
}

/** "Intra" or the inter-exercise technique's name — what to do next time. */
function methodLabel(interTechniqueId?: string): string {
  if (!interTechniqueId) return "Intra";
  return TECHNIQUES_BY_ID.get(interTechniqueId)?.name ?? "Inter";
}

/**
 * Current progression, method and best set for every skill/strength exercise,
 * for the Progress tab.
 */
export function buildProgressRows(
  exercises: Exercise[],
  completed: WorkoutSession[],
  stats: Record<string, VolumeStats>,
): ProgressRow[] {
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

  return exercises
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
          ? `${progression.name} · best ${best ?? "—"}${bestUnit(measurementOf(ex, progression.id))} · ${methodLabel(currentMethod.get(ex.id))}`
          : "Not trained yet",
        step,
        totalSteps: ex.progressions.length,
      };
    });
}
