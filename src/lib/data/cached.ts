import "server-only";
import { unstable_cache } from "next/cache";
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

const ONE_DAY_SECONDS = 60 * 60 * 24;

/**
 * Everything the Programs page lists, cached for a day per user and busted
 * whenever the user adds/edits/deletes a program or workout (or a run
 * starts/finishes, which flips the "Active" badge).
 */
export function getCachedUserPrograms(store: DataStore, userId: string) {
  return unstable_cache(
    async () => {
      const [programs, runs, customWorkouts] = await Promise.all([
        store.listPrograms(userId),
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
