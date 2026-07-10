import { Weekday, WEEKDAYS } from "./types";
import { Program, WorkoutSession } from "./schemas";

/** Monday-first weekday of a Date, matching our Weekday union. */
export function weekdayOf(date: Date): Weekday {
  // JS getDay(): 0 = Sunday … 6 = Saturday. Shift so 0 = Monday.
  return WEEKDAYS[(date.getDay() + 6) % 7];
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/** The Monday of the calendar week containing the given date. */
export function mondayOf(date: Date): Date {
  return addDays(date, -((date.getDay() + 6) % 7));
}

/** Next occurrence (today included) of the given weekday. */
export function nextOccurrence(from: Date, weekday: Weekday): Date {
  const target = WEEKDAYS.indexOf(weekday);
  const current = (from.getDay() + 6) % 7;
  return addDays(from, (target - current + 7) % 7);
}

/**
 * Generate the dated workout sessions for a run.
 *
 * Weeks are calendar-aligned (Mon–Sun): week 1 is the calendar week that
 * contains startDate, so the designer's week/day grid maps 1:1 onto real
 * dates. Training days of week 1 that fall before startDate are skipped —
 * starting mid-week means a shorter first week, never a scrambled one.
 */
export function generateSessions(
  program: Program,
  runId: string,
  startDate: string,
): Omit<WorkoutSession, "id">[] {
  const start = parseISODate(startDate);
  const weekStart = mondayOf(start);
  const sessions: Omit<WorkoutSession, "id">[] = [];

  for (let weekIndex = 0; weekIndex < program.weeks; weekIndex++) {
    const week = program.mesocycle.weeks[weekIndex];
    if (!week) continue;
    for (let offset = 0; offset < 7; offset++) {
      const date = addDays(weekStart, weekIndex * 7 + offset);
      if (date < start) continue;
      const weekday = weekdayOf(date);
      if (!program.trainingDays.includes(weekday)) continue;
      if (!week.days[weekday]) continue;
      sessions.push({
        runId,
        userId: program.userId,
        date: toISODate(date),
        weekIndex,
        weekday,
        status: "planned",
        entries: [],
      });
    }
  }
  return sessions;
}
