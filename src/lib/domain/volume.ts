import { VolumeStats, WorkoutSession } from "./schemas";

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
