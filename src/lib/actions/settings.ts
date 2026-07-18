"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
// Name/avatar/body-stats reads come from the per-request profile fetch in
// requireUser (never from unstable_cache), so these actions only need to
// refresh the visited pages — no tag busting, and NEVER the layout-wide
// revalidatePath("/", "layout"), which would wipe every cache in the app.
import { z } from "zod";
import { MOCK_ADMIN_COOKIE, requireUser } from "@/lib/auth";
import { dataBackend, getStore } from "@/lib/data";
import { AVATARS_BUCKET, getBlobStore } from "@/lib/storage";

const nameSchema = z.string().trim().min(1).max(60);

/** Change the display name shown across the app. */
export async function updateName(name: string): Promise<void> {
  const user = await requireUser();
  const parsed = nameSchema.parse(name);
  const store = await getStore();
  await store.updateProfileName(user.id, parsed);
  revalidatePath("/");
  revalidatePath("/settings");
}

// One canonical file per user; uploading a new picture overwrites it. All
// three extensions are cleared on change so switching formats leaves no
// orphan behind.
const AVATAR_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const AVATAR_MAX_BYTES = 5 * 1024 * 1024; // matches the bucket limit

/** Upload a profile picture from the user's device (form field "avatar"). */
export async function uploadAvatar(formData: FormData): Promise<void> {
  const user = await requireUser();
  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Pick an image first");
  }
  const ext = AVATAR_TYPES[file.type];
  if (!ext) throw new Error("Use a JPEG, PNG or WebP image");
  if (file.size > AVATAR_MAX_BYTES) throw new Error("Image is over 5 MB");

  const blobs = await getBlobStore();
  for (const stale of Object.values(AVATAR_TYPES)) {
    if (stale !== ext) {
      await blobs.remove(AVATARS_BUCKET, `${user.id}/avatar.${stale}`);
    }
  }
  const url = await blobs.put(
    AVATARS_BUCKET,
    `${user.id}/avatar.${ext}`,
    new Uint8Array(await file.arrayBuffer()),
    file.type,
  );

  const store = await getStore();
  // Cache-buster: the path is stable, so browsers would keep the old image.
  await store.updateProfileAvatar(user.id, `${url}?v=${Date.now()}`);
  revalidatePath("/");
  revalidatePath("/settings");
}

/** Remove the profile picture (falls back to the initial-letter avatar). */
export async function removeAvatar(): Promise<void> {
  const user = await requireUser();
  const blobs = await getBlobStore();
  for (const ext of Object.values(AVATAR_TYPES)) {
    await blobs.remove(AVATARS_BUCKET, `${user.id}/avatar.${ext}`);
  }
  const store = await getStore();
  await store.updateProfileAvatar(user.id, null);
  revalidatePath("/");
  revalidatePath("/settings");
}

const bodyStatsSchema = z.object({
  heightCm: z.number().positive().max(300).nullable(),
  targetWeightKg: z.number().positive().max(1000).nullable(),
});

/** Save height and ideal target weight (BMI inputs); null clears a value. */
export async function saveBodyStats(input: {
  heightCm: number | null;
  targetWeightKg: number | null;
}): Promise<void> {
  const user = await requireUser();
  const parsed = bodyStatsSchema.parse(input);
  const store = await getStore();
  await store.updateProfileStats(user.id, parsed);
  revalidatePath("/");
  revalidatePath("/settings");
}

/**
 * Show or hide the welcome tour on the next visit. The tour page calls this
 * with false when dismissed; the Settings toggle calls it either way.
 */
export async function setShowWelcome(show: boolean): Promise<void> {
  const user = await requireUser();
  const store = await getStore();
  await store.updateProfileWelcome(user.id, z.boolean().parse(show));
  revalidatePath("/");
  revalidatePath("/welcome");
  revalidatePath("/settings");
}

/**
 * Dismiss (or re-arm) the workout-designer intro carousel. Called with false
 * when the athlete closes the intro on their first designer visit.
 */
export async function setShowDesignerIntro(show: boolean): Promise<void> {
  const user = await requireUser();
  const store = await getStore();
  await store.updateProfileDesignerIntro(user.id, z.boolean().parse(show));
  revalidatePath("/programs");
}

/**
 * Master switch for the in-app tips: the welcome tour and the workout-
 * designer intro together. Each tip still dismisses only itself when
 * closed; this Settings toggle re-arms or silences both at once.
 */
export async function setShowTips(show: boolean): Promise<void> {
  const user = await requireUser();
  const parsed = z.boolean().parse(show);
  const store = await getStore();
  await store.updateProfileWelcome(user.id, parsed);
  await store.updateProfileDesignerIntro(user.id, parsed);
  revalidatePath("/");
  revalidatePath("/welcome");
  revalidatePath("/programs");
  revalidatePath("/settings");
}

/** Dev-only: toggle admin rights on the mock session. */
export async function setAdminMode(enabled: boolean): Promise<void> {
  if (dataBackend() === "supabase") {
    throw new Error("Admin rights are managed in Supabase in production");
  }
  const jar = await cookies();
  if (enabled) {
    jar.set(MOCK_ADMIN_COOKIE, "1", { path: "/" });
  } else {
    jar.delete(MOCK_ADMIN_COOKIE);
  }
  revalidatePath("/", "layout");
}
