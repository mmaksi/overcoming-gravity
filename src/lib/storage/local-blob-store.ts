import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { BlobStore } from "./blob-store";

/**
 * Development file storage: writes under public/uploads so the dev server
 * serves the files straight away. The directory is gitignored.
 */
export class LocalBlobStore implements BlobStore {
  private root = path.join(process.cwd(), "public", "uploads");

  /** Resolve inside the uploads root, refusing path traversal. */
  private resolve(bucket: string, filePath: string): string {
    const absolute = path.resolve(this.root, bucket, filePath);
    if (!absolute.startsWith(this.root + path.sep)) {
      throw new Error("Invalid storage path");
    }
    return absolute;
  }

  async put(
    bucket: string,
    filePath: string,
    bytes: Uint8Array,
  ): Promise<string> {
    const absolute = this.resolve(bucket, filePath);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, bytes);
    return `/uploads/${bucket}/${filePath}`;
  }

  async remove(bucket: string, filePath: string): Promise<void> {
    await rm(this.resolve(bucket, filePath), { force: true });
  }
}
