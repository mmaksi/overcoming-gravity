/**
 * Query keys for the client-side TanStack Query cache. Kept in one place so a
 * mutation and the read it invalidates can never drift apart.
 *
 * Only data that is fetched or mutated *inside a client component* lives here —
 * server components keep reading through the Next server-cache layer
 * (see lib/data/cached.ts). The two client reads are the calendar's history
 * feed (infinite scroll) and the Progress tab's aggregate rows.
 */
export const queryKeys = {
  /** Completed-workout history, paged (infinite scroll). */
  history: () => ["history"] as const,
  /** Progress overview rows (heavy full-history aggregate). */
  progress: () => ["progress"] as const,
};
