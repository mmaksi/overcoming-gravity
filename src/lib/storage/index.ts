import "server-only";
import { dataBackend } from "@/lib/data";
import { BlobStore } from "./blob-store";
import { LocalBlobStore } from "./local-blob-store";

export { AVATARS_BUCKET } from "./blob-store";
export type { BlobStore } from "./blob-store";

let localBlobStore: LocalBlobStore | null = null;

/**
 * Returns the BlobStore for the current request. Follows the same backend
 * switch as the DataStore: local files in development, Supabase Storage in
 * production.
 */
export async function getBlobStore(): Promise<BlobStore> {
  if (dataBackend() === "supabase") {
    const { createSupabaseBlobStore } = await import("./supabase-blob-store");
    return createSupabaseBlobStore();
  }
  if (!localBlobStore) localBlobStore = new LocalBlobStore();
  return localBlobStore;
}
