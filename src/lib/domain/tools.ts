// Pure, UI-agnostic logic behind the athlete Tools. Kept here (not in the
// components) so the rules stay testable and in one place.

export type SweetSpot = {
  /** Number of sets. */
  sets: number;
  /** Hold duration of each set, in seconds. */
  hold: number;
};

// Recommended isometric "sweet spot" per max-hold, from the coaching table.
// Index 0 is unused; entries run from a 1s max hold up to 15s. A given max
// hold is clamped into this range before lookup.
const SWEET_SPOTS: readonly SweetSpot[] = [
  { sets: 0, hold: 0 }, // placeholder for index 0
  { sets: 8, hold: 1 }, // 1
  { sets: 7, hold: 2 }, // 2
  { sets: 7, hold: 3 }, // 3
  { sets: 7, hold: 3 }, // 4
  { sets: 6, hold: 4 }, // 5
  { sets: 6, hold: 5 }, // 6
  { sets: 6, hold: 5 }, // 7
  { sets: 6, hold: 6 }, // 8
  { sets: 6, hold: 6 }, // 9
  { sets: 5, hold: 7 }, // 10
  { sets: 5, hold: 8 }, // 11
  { sets: 5, hold: 8 }, // 12
  { sets: 5, hold: 9 }, // 13
  { sets: 5, hold: 10 }, // 14
  { sets: 5, hold: 10 }, // 15
];

export const MAX_HOLD_MIN = 1;
export const MAX_HOLD_MAX = 15;

/**
 * Recommended isometric sweet spot for a given max hold (in seconds). The max
 * hold is rounded to the nearest whole second and clamped to [1, 15] — the
 * range the coaching table covers.
 */
export function isometricSweetSpot(maxHoldSeconds: number): SweetSpot {
  const rounded = Math.round(maxHoldSeconds);
  const clamped = Math.min(MAX_HOLD_MAX, Math.max(MAX_HOLD_MIN, rounded));
  return SWEET_SPOTS[clamped];
}

/** "5x10" — sets × hold seconds. */
export function formatSweetSpot({ sets, hold }: SweetSpot): string {
  return `${sets}x${hold}`;
}

/**
 * Estimated one-rep max (Epley formula):
 *
 *   1RM = totalWeight × (1 + reps / 30)
 *
 * `totalWeight` is whatever the athlete actually moved: the loaded barbell, or
 * for weighted calisthenics their bodyweight plus any added weight. Returns 0
 * for non-positive inputs so callers can treat that as "no result".
 */
export function oneRepMax(totalWeight: number, reps: number): number {
  if (totalWeight <= 0 || reps <= 0) return 0;
  return totalWeight * (1 + reps / 30);
}

/**
 * One-rep max for weighted calisthenics, expressed as the *added* load. The
 * Epley estimate runs on the full lifted weight (bodyweight + added), then
 * bodyweight is subtracted back out — bodyweight is always present, so a 1RM is
 * only meaningful as the extra load you can add on top of it. Returns 0 for
 * non-positive inputs.
 */
export function weightedOneRepMax(
  bodyweight: number,
  addedWeight: number,
  reps: number,
): number {
  if (bodyweight <= 0 || reps <= 0) return 0;
  const total = oneRepMax(bodyweight + addedWeight, reps);
  return total - bodyweight;
}
