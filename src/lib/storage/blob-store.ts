/**
 * The seam between the app and file storage, mirroring the DataStore seam:
 * LocalBlobStore (development, files under public/uploads) and
 * SupabaseBlobStore (production, Supabase Storage buckets with RLS).
 * Server actions must only ever talk to this interface.
 */
export interface BlobStore {
  /**
   * Store `bytes` at `bucket/path`, overwriting any previous file, and
   * return a public URL for it. Paths are namespaced per user
   * ("<user-id>/...") so storage policies can enforce ownership.
   */
  put(
    bucket: string,
    path: string,
    bytes: Uint8Array,
    contentType: string,
  ): Promise<string>;

  /** Delete the file at `bucket/path`; missing files are not an error. */
  remove(bucket: string, path: string): Promise<void>;
}

/** Bucket for profile pictures (see supabase/migrations/0009). */
export const AVATARS_BUCKET = "avatars";
