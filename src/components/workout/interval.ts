/**
 * Phase logic for the HIIT / Tabata runner, kept pure so it is testable
 * without the timer UI around it.
 *
 * A run is a fixed schedule derived from the clock: a short get-ready
 * countdown, then `rounds` cycles of work + rest. Deriving the phase from
 * elapsed time (instead of stepping through states) means the runner lands
 * on the right phase even after the browser throttled or slept its timers.
 */

export type IntervalSettings = {
  workSeconds: number;
  restSeconds: number;
  rounds: number;
};

/** Get-ready lead-in before the first work phase (matches 4321.mp3). */
export const PREP_SECONDS = 4;

export type IntervalPhase =
  | { kind: "prep"; secondsLeft: number }
  | { kind: "work" | "rest"; round: number; secondsLeft: number }
  | { kind: "finished" };

export function phaseAt(
  elapsedSeconds: number,
  settings: IntervalSettings,
): IntervalPhase {
  let t = Math.max(0, elapsedSeconds);
  if (t < PREP_SECONDS) return { kind: "prep", secondsLeft: PREP_SECONDS - t };
  t -= PREP_SECONDS;
  const cycle = settings.workSeconds + settings.restSeconds;
  const round = Math.floor(t / cycle);
  if (round >= settings.rounds) return { kind: "finished" };
  const inRound = t - round * cycle;
  return inRound < settings.workSeconds
    ? { kind: "work", round: round + 1, secondsLeft: settings.workSeconds - inRound }
    : { kind: "rest", round: round + 1, secondsLeft: cycle - inRound };
}

/** Full running time of the intervals themselves (prep not counted). */
export function totalSeconds(settings: IntervalSettings): number {
  return settings.rounds * (settings.workSeconds + settings.restSeconds);
}
