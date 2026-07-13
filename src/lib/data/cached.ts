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
