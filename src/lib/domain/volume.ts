import { Exercise, VolumeStats, WorkoutSession } from "./schemas";
import { addDays, mondayOf, parseISODate, toISODate } from "./schedule";
import { CATEGORIES, Category } from "./types";

export function statsKey(exerciseId: string, progressionId: string): string {
  return `${exerciseId}:${progressionId}`;
}

/**
 * Fold completed sessions (newest first) into per-progression stats:
 * the most recent volume and the all-time best single-set value. Powers the
 * "last time" line, max-rep placeholders and the progress overview.
 */
export function buildVolumeStats(
  completedNewestFirst: WorkoutSession[],
): Record<string, VolumeStats> {
  const index: Record<string, VolumeStats> = {};
  for (const session of completedNewestFirst) {
    for (const entry of session.entries) {
      if (entry.performedSets.length === 0) continue;
      const key = statsKey(entry.exerciseId, entry.progressionId);
      const stats = (index[key] ??= { last: null, maxReps: null });
      if (!stats.last) {
        stats.last = { date: session.date, performedSets: entry.performedSets };
      }
      for (const set of entry.performedSets) {
        if (set.reps === null) continue; // never recorded
        // Hybrid parts: credit each progression with its own reps instead of
        // counting the set total against the entry's progression.
        if (set.parts && set.parts.length > 0) {
          for (const part of set.parts) {
            const partKey = statsKey(entry.exerciseId, part.progressionId);
            const partStats = (index[partKey] ??= { last: null, maxReps: null });
            if (partStats.maxReps === null || part.reps > partStats.maxReps) {
              partStats.maxReps = part.reps;
            }
          }
          continue;
        }
        if (stats.maxReps === null || set.reps > stats.maxReps) {
          stats.maxReps = set.reps;
        }
      }
    }
  }
  return index;
}

// ---------------------------------------------------------------------------
// Weekly volume by movement pattern

/** How many calendar weeks the overview looks back over, this week included. */
export const VOLUME_WEEKS = 8;

export type WeekVolume = {
  /** ISO date of the week's Monday. */
  weekStart: string;
  /** Working sets per pattern; every category present, 0 when untrained. */
  sets: Record<Category, number>;
  total: number;
  /** Completed workouts that week — volume can come from several. */
  workouts: number;
};

function emptySets(): Record<Category, number> {
  return Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<
    Category,
    number
  >;
}

/**
 * Working sets per movement pattern for each of the last `weeks` calendar
 * weeks (Mon–Sun), newest first. Weeks with nothing logged still come back —
 * a gap is one of the more useful things this overview shows.
 *
 * Only strength work counts: push/pull/legs is a strength-only property, so a
 * warm-up, stretch or prehab set has no pattern to file under and is left out.
 * Sets are the unit rather than reps because a set is comparable across a
 * ten-rep push-up and a five-second hold, which reps are not. A set counts
 * once it holds a value above zero: drafts leave `reps` null, and an explicit
 * zero is a set that wasn't performed. Hybrid sets count once, like any other.
 */
export function buildWeeklyVolume(
  completed: WorkoutSession[],
  exercises: Exercise[],
  today: string,
  weeks = VOLUME_WEEKS,
): WeekVolume[] {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  // Newest first, so insertion order is already the render order.
  const byWeek = new Map<string, WeekVolume>();
  const thisMonday = mondayOf(parseISODate(today));
  for (let i = 0; i < weeks; i++) {
    const weekStart = toISODate(addDays(thisMonday, -7 * i));
    byWeek.set(weekStart, {
      weekStart,
      sets: emptySets(),
      total: 0,
      workouts: 0,
    });
  }

  for (const session of completed) {
    const week = byWeek.get(toISODate(mondayOf(parseISODate(session.date))));
    if (!week) continue; // older than the window
    week.workouts++;
    for (const entry of session.entries) {
      const exercise = byId.get(entry.exerciseId);
      if (!exercise) continue; // deleted from the library since
      if (!exercise.category) continue; // strength-only; no pattern to bucket
      const sets = entry.performedSets.filter((s) => (s.reps ?? 0) > 0).length;
      week.sets[exercise.category] += sets;
      week.total += sets;
    }
  }

  return [...byWeek.values()];
}
