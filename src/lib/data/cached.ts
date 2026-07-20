import "server-only";
import { unstable_cache } from "next/cache";
import {
  ProgramDayPlan,
  ProgramRun,
  ProgramSummary,
  SessionSummary,
} from "@/lib/domain/schemas";
import { Weekday } from "@/lib/domain/types";
import { DataStore } from "./store";

/**
 * Exercises and the default template are global content that only changes
 * when an admin edits it — so cache them aggressively and bust the cache with
 * `revalidateTag` on admin writes (see lib/actions/admin.ts).
 *
 * The per-request `store` is closed over so the rare cache-miss read runs with
 * the caller's authenticated client (the content RLS requires the
 * `authenticated` role); the cached entry itself is keyed globally and shared
 * across all users, since this content is identical for everyone.
 */
export const EXERCISES_TAG = "content:exercises";
export const DEFAULT_TEMPLATE_TAG = "content:default-template";

const ONE_WEEK_SECONDS = 60 * 60 * 24 * 7;

export function getCachedExercises(store: DataStore) {
  return unstable_cache(() => store.listExercises(), ["content", "exercises"], {
    revalidate: ONE_WEEK_SECONDS,
    tags: [EXERCISES_TAG],
  })();
}

export function getCachedDefaultTemplate(store: DataStore) {
  return unstable_cache(
    () => store.getDefaultTemplate(),
    ["content", "default-template"],
    { revalidate: ONE_WEEK_SECONDS, tags: [DEFAULT_TEMPLATE_TAG] },
  )();
}

// ---------------------------------------------------------------------------
// Per-user caches. Unlike the content caches above these MUST be keyed AND
// tagged by userId — a globally-keyed entry would leak one user's data to
// everyone (docs/scaling-and-security.md, S4). Mutating server actions bust
// them with `updateTag(...)` — read-your-own-writes, so the user sees their
// change immediately.

/** Tag for a user's programs, runs and custom workouts (the /programs page). */
export const userProgramsTag = (userId: string) => `user:${userId}:programs`;
/** Tag for a user's completed-workout history and progress overview. */
export const userHistoryTag = (userId: string) => `user:${userId}:history`;
/** Tag for the home dashboard's run cards (active runs + their sessions). */
export const userDashboardTag = (userId: string) => `user:${userId}:dashboard`;
/** Tag for the home Stats block (bodyweight entries). */
export const userStatsTag = (userId: string) => `user:${userId}:stats`;

const ONE_DAY_SECONDS = 60 * 60 * 24;

/**
 * Everything the Programs page lists, cached for a day per user and busted
 * whenever the user adds/edits/deletes a program or workout (or a run
 * starts/finishes, which flips the "Active" badge).
 */
export function getCachedUserPrograms(store: DataStore, userId: string) {
  return unstable_cache(
    async () => {
      // Program *summaries* only — the list cards, dashboard and history labels
      // never render the (large) mesocycle. Custom workouts stay whole: they're
      // small and the /programs page shows each one's exercise count.
      const [programs, runs, customWorkouts] = await Promise.all([
        store.listProgramSummaries(userId),
        store.listRuns(userId),
        store.listCustomWorkouts(userId),
      ]);
      return { programs, runs, customWorkouts };
    },
    ["user-programs", userId],
    { revalidate: ONE_DAY_SECONDS, tags: [userProgramsTag(userId)] },
  )();
}

/**
 * One page of a user's completed workouts (newest first). History is
 * append-mostly — old pages barely change — so pages cache well; completing
 * or deleting a workout busts the whole tag.
 */
export function getCachedCompletedPage(
  store: DataStore,
  userId: string,
  offset: number,
  limit: number,
) {
  return unstable_cache(
    () => store.listCompletedSessions(userId, limit, offset),
    ["user-history", userId, String(offset), String(limit)],
    { revalidate: ONE_WEEK_SECONDS, tags: [userHistoryTag(userId)] },
  )();
}

/** The full completed history (progress overview + volume stats). */
export function getCachedCompletedSessions(store: DataStore, userId: string) {
  return unstable_cache(
    () => store.listCompletedSessions(userId),
    ["user-history-full", userId],
    { revalidate: ONE_WEEK_SECONDS, tags: [userHistoryTag(userId)] },
  )();
}

/**
 * Finished schedule slots (completed + skipped, oldest first) for the home
 * streak. Same tag as history — completing or skipping a workout busts it.
 */
export function getCachedFinishedSessions(store: DataStore, userId: string) {
  return unstable_cache(
    () => store.listFinishedSessions(userId),
    ["user-finished-sessions", userId],
    { revalidate: ONE_WEEK_SECONDS, tags: [userHistoryTag(userId)] },
  )();
}

/**
 * One active run's card data on the home dashboard. Program and sessions are
 * summaries (no mesocycle, no performed-set entries) — the card only needs
 * name/weeks/goals and each session's date/status. The single "up next" day is
 * fetched separately (getCachedProgramDay) since which day is upcoming depends
 * on today's date, not on the cached schedule.
 */
export type DashboardRun = {
  run: ProgramRun;
  program: ProgramSummary | null;
  sessions: SessionSummary[];
};

/**
 * Everything the home run cards show, cached indefinitely — busted only when
 * the schedule actually changes: an explicit workout save/complete/skip (the
 * 2.5s draft autosave does NOT bust it), a run starting/resetting/abandoning,
 * a mesocycle redesign, goal edits, or deleting a program/session.
 */
export function getCachedDashboard(
  store: DataStore,
  userId: string,
): Promise<DashboardRun[]> {
  return unstable_cache(
    async () => {
      const runs = (await store.listRuns(userId)).filter(
        (r) => r.status === "active",
      );
      const cards = await Promise.all(
        runs.map(async (run) => ({
          run,
          program: await store.getProgramSummary(run.programId),
          sessions: await store.listSessionSummariesByRun(run.id),
        })),
      );
      // Most recently trained program first: rank by the last day a workout
      // was actually run (completed or skipped), falling back to the run's
      // start date for programs not yet touched. Sessions come back ascending
      // by date, so the last finished one is the newest.
      const lastTrained = ({ run, sessions }: DashboardRun) =>
        sessions.findLast((s) => s.status !== "planned")?.date ?? run.startDate;
      return cards.sort((a, b) => lastTrained(b).localeCompare(lastTrained(a)));
    },
    ["user-dashboard", userId],
    { tags: [userDashboardTag(userId)] },
  )();
}

/**
 * The single planned day the dashboard shows as "up next". Keyed by the exact
 * (program, week, weekday) slot so each distinct day caches on first render and
 * repeat loads on the same day are free; busted with the dashboard tag when the
 * mesocycle is redesigned.
 */
export function getCachedProgramDay(
  store: DataStore,
  userId: string,
  programId: string,
  weekIndex: number,
  weekday: Weekday,
): Promise<ProgramDayPlan | null> {
  return unstable_cache(
    () => store.getProgramDay(programId, weekIndex, weekday),
    // "-plan" versions the key: the cached shape changed from a bare
    // WorkoutDay to ProgramDayPlan, and stale entries survive restarts and
    // even deploys — a shape change must always change the key.
    ["program-day-plan", programId, String(weekIndex), weekday],
    { tags: [userDashboardTag(userId)] },
  )();
}

/**
 * Bodyweight entries for the home Stats block, cached indefinitely — busted
 * only when the user logs/edits/deletes a weigh-in in Settings.
 */
export function getCachedBodyweight(store: DataStore, userId: string) {
  return unstable_cache(
    () => store.listBodyweightEntries(userId),
    ["user-bodyweight", userId],
    { tags: [userStatsTag(userId)] },
  )();
}
