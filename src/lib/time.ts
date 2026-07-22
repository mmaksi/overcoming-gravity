/** Milliseconds in a day — for date-diff / calendar math. */
export const ONE_DAY_MS = 1000 * 60 * 60 * 24;

/**
 * Formats a duration in seconds as a running clock: `MM:SS`, or `H:MM:SS`
 * once it passes an hour. Used for the live workout clock and recorded
 * session durations.
 */
export function formatClock(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Compact human duration for mode summaries: whole minutes render as
 * `"2 min"`, anything else as raw seconds (`"90s"`).
 */
export function shortDuration(seconds: number): string {
  return seconds % 60 === 0 ? `${seconds / 60} min` : `${seconds}s`;
}
