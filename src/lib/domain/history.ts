import {
  convertMeasureValue,
  CustomWorkoutSummary,
  Exercise,
  ExerciseNote,
  measurementOf,
  ProgramRun,
  ProgramSummary,
  WorkoutSession,
} from "@/lib/domain/schemas";
import {
  Measurement,
  MEASUREMENT_UNIT,
  TECHNIQUES_BY_ID,
  WEEKDAY_LABELS,
} from "@/lib/domain/types";
import { statsKey } from "@/lib/domain/volume";
import { formatClock } from "@/lib/time";

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
          ? formatClock(session.durationSeconds)
          : undefined,
      pushVolume,
      pullVolume,
      lines,
    };
  });
}

// ---------------------------------------------------------------------------
// Personal records (the Progress tab + the home records card)
//
// A record is the athlete's all-time best *for one progression* — not one
// summary per exercise. "Best" ranks the heaviest added load first, then the
// highest value (reps, or seconds/minutes of hold) at that load, so a weighted
// pull-up at 15 kg × 5 outranks a bodyweight set of 12, and a bodyweight-only
// progression simply keeps its highest value. Only progressions with at least
// one recorded set appear; untrained ones are hidden.

/** The single best recorded set of one progression. */
type BestSet = {
  /** Value in the progression's own unit: reps, or seconds/minutes of hold. */
  value: number;
  /** Added load in kg for that set (0 = bodyweight). */
  weightKg: number;
};

/** One trained progression's all-time record, ready to render. */
export type ProgressionRecord = {
  progressionId: string;
  name: string;
  /** 1-based position in the exercise's full progression ladder. */
  level: number;
  totalLevels: number;
  /** Formatted best, e.g. "15 kg × 5", "12 reps", "1:30" (a hold). */
  best: string;
  /** The athlete's remembered note for this progression, if any. */
  note?: string;
};

/** Every trained progression of one exercise, grouped for the records list. */
export type ExerciseRecordGroup = {
  exerciseId: string;
  title: string;
  attribute: "skill" | "strength";
  records: ProgressionRecord[];
};

/** Ranks candidate sets: heavier wins, then the higher value at equal load. */
function isBetterSet(candidate: BestSet, current: BestSet | undefined): boolean {
  if (!current) return true;
  if (candidate.weightKg !== current.weightKg) {
    return candidate.weightKg > current.weightKg;
  }
  return candidate.value > current.value;
}

/**
 * Fold completed sessions into the best recorded set per
 * exercise+progression (keyed by `statsKey`). Values are normalized into the
 * progression's own unit, so a hold logged once in seconds and once in minutes
 * compares correctly. Hybrid sets credit each part's own progression (matching
 * `buildVolumeStats`); parts carry no load, so they compete on value alone.
 */
export function buildProgressionBests(
  completed: WorkoutSession[],
  exercisesById: Map<string, Exercise>,
): Map<string, BestSet> {
  const bests = new Map<string, BestSet>();
  const consider = (key: string, candidate: BestSet) => {
    if (isBetterSet(candidate, bests.get(key))) bests.set(key, candidate);
  };

  for (const session of completed) {
    for (const entry of session.entries) {
      const ex = exercisesById.get(entry.exerciseId);
      const logged = measurementOf(ex, entry.progressionId, entry.measurement);
      for (const set of entry.performedSets) {
        if (set.reps === null) continue; // never recorded
        if (set.parts && set.parts.length > 0) {
          for (const part of set.parts) {
            consider(statsKey(entry.exerciseId, part.progressionId), {
              value: part.reps,
              weightKg: 0,
            });
          }
          continue;
        }
        // Normalize the logged value into the progression's own unit.
        const canonical = measurementOf(ex, entry.progressionId);
        consider(statsKey(entry.exerciseId, entry.progressionId), {
          value: convertMeasureValue(set.reps, logged, canonical),
          weightKg: set.weight ?? 0,
        });
      }
    }
  }
  return bests;
}

/** A hold in seconds shown as "m:ss" once it passes a minute (e.g. "1:30"). */
function formatHold(value: number, measurement: Measurement): string {
  const seconds =
    measurement === "minutes" ? Math.round(value * 60) : Math.round(value);
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Format a best set for display in its own unit, with load when present. */
export function formatBest(
  value: number,
  measurement: Measurement,
  weightKg: number,
): string {
  const amount =
    measurement === "reps"
      ? String(Math.round(value))
      : formatHold(value, measurement);
  if (weightKg > 0) return `${weightKg} kg × ${amount}`;
  return measurement === "reps"
    ? `${amount} ${MEASUREMENT_UNIT.reps}`
    : amount;
}

/**
 * The records shown on the Progress tab: every trained progression of every
 * skill/strength exercise, grouped by exercise, each with its formatted best
 * and remembered note. Exercises with no trained progression drop out.
 */
export function buildExerciseRecords(
  exercises: Exercise[],
  completed: WorkoutSession[],
  notes: ExerciseNote[],
): ExerciseRecordGroup[] {
  const exercisesById = new Map(exercises.map((e) => [e.id, e]));
  const bests = buildProgressionBests(completed, exercisesById);
  const noteByKey = new Map(
    notes.map((n) => [statsKey(n.exerciseId, n.progressionId), n.note]),
  );

  return exercises
    .filter((e) => e.attribute === "skill" || e.attribute === "strength")
    .map((ex) => {
      const records: ProgressionRecord[] = [];
      ex.progressions.forEach((prog, i) => {
        const best = bests.get(statsKey(ex.id, prog.id));
        if (!best) return; // progression never trained — hidden
        const note = noteByKey.get(statsKey(ex.id, prog.id))?.trim();
        records.push({
          progressionId: prog.id,
          name: prog.name,
          level: i + 1,
          totalLevels: ex.progressions.length,
          best: formatBest(
            best.value,
            measurementOf(ex, prog.id),
            best.weightKg,
          ),
          note: note || undefined,
        });
      });
      return {
        exerciseId: ex.id,
        title: ex.title,
        attribute: ex.attribute as "skill" | "strength",
        records,
      };
    })
    .filter((group) => group.records.length > 0)
    .sort((a, b) => a.title.localeCompare(b.title));
}
