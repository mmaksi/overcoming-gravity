import "server-only";
import { DataStore } from "./store";
import { JsonStore } from "./json-store";

let jsonStore: JsonStore | null = null;

export function dataBackend(): "json" | "supabase" {
  const backend =
    process.env.DATA_BACKEND ??
    (process.env.NODE_ENV === "production" ? "supabase" : "json");
  return backend === "supabase" ? "supabase" : "json";
}

/**
 * Returns the DataStore for the current request. Backend is chosen by
 * DATA_BACKEND: "json" (default in development) or "supabase" (production).
 * The Supabase store is per-request because it carries the caller's session
 * cookie so RLS applies; the JSON store is a process-wide singleton.
 */
export async function getStore(): Promise<DataStore> {
  if (dataBackend() === "supabase") {
    const { createSupabaseStore } = await import("./supabase-store");
    return createSupabaseStore();
  }
  if (!jsonStore) jsonStore = new JsonStore();
  return jsonStore;
}

/**
 * Store for server-side billing writes (webhooks, checkout, subscription
 * sync): billing columns are protected from user-scoped sessions, so these
 * paths need the service role in Supabase mode. The JSON store has no RLS —
 * the regular singleton serves both roles in development.
 */
export async function getServiceStore(): Promise<DataStore> {
  if (dataBackend() === "supabase") {
    const { createServiceSupabaseStore } = await import("./supabase-store");
    return createServiceSupabaseStore();
  }
  return getStore();
}
