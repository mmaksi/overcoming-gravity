import { Flame } from "lucide-react";

/** Local-midnight Monday of the week containing a "YYYY-MM-DD" date. */
function mondayOf(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  // getDay(): 0=Sun..6=Sat — days to step back to Monday.
  dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
  dt.setHours(0, 0, 0, 0);
  return dt.getTime();
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Consecutive weeks (Mon–Sun) with at least one completed workout — a far more
 * motivating measure than a day streak for a 3–4×/week calisthenics plan.
 * The streak stays alive if you've trained this week OR last week (a grace
 * week so it doesn't reset the moment a new week starts).
 */
function weekStreak(dates: string[], today: string): number {
  if (dates.length === 0) return 0;
  const weeks = new Set(dates.map(mondayOf));
  const thisWeek = mondayOf(today);
  // Start from this week, or fall back to last week if this one's untrained.
  let cursor = weeks.has(thisWeek) ? thisWeek : thisWeek - WEEK_MS;
  let streak = 0;
  while (weeks.has(cursor)) {
    streak++;
    cursor -= WEEK_MS;
  }
  return streak;
}

/**
 * The home "Streak" box: a flame with the current weekly workout streak plus
 * the all-time completed count. `dates` are the ISO dates of completed
 * sessions (cached until a workout is completed/deleted, so this stays fresh).
 */
export function StreakCard({
  dates,
  today,
}: {
  dates: string[];
  today: string;
}) {
  const streak = weekStreak(dates, today);
  const total = dates.length;

  return (
    <div className="space-y-3">
      <h2 className="flex items-center gap-2 text-base font-semibold uppercase tracking-wide text-primary">
        <Flame className="size-5" /> Streak
      </h2>
      <div className="flex items-center gap-4 rounded-xl border bg-gradient-to-br from-primary/10 to-primary/5 p-4">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Flame className="size-7" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-bold tabular-nums">{streak}</span>
            <span className="text-sm font-medium text-muted-foreground">
              {streak === 1 ? "week" : "weeks"} in a row
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {streak === 0
              ? "Complete a workout this week to start a streak."
              : `${total} workout${total === 1 ? "" : "s"} completed all-time`}
          </p>
        </div>
      </div>
    </div>
  );
}
