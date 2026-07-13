import "server-only";
import { SupabaseClient } from "@supabase/supabase-js";
import { BlobStore } from "./blob-store";

/**
 * Production file storage: Supabase Storage. Buckets and their RLS policies
 * live in migrations (0009 creates "avatars"); the per-request client carries
 * the caller's session so the "own folder only" write policies apply.
 */
class SupabaseBlobStore implements BlobStore {
  constructor(private db: SupabaseClient) {}

  async put(
    bucket: string,
    path: string,
    bytes: Uint8Array,
    contentType: string,
  ): Promise<string> {
    const { error } = await this.db.storage
      .from(bucket)
      .upload(path, bytes, { contentType, upsert: true });
    if (error) throw new Error(error.message);
    return this.db.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }

  async remove(bucket: string, path: string): Promise<void> {
    const { error } = await this.db.storage.from(bucket).remove([path]);
    if (error) throw new Error(error.message);
  }
}

/** Per-request blob store: carries the caller's session cookie for RLS. */
export async function createSupabaseBlobStore(): Promise<BlobStore> {
  const { createServerSupabase } = await import("@/lib/supabase/server");
  return new SupabaseBlobStore(await createServerSupabase());
}
