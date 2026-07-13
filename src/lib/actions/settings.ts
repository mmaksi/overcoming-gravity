"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MOCK_ADMIN_COOKIE, requireUser } from "@/lib/auth";
import { dataBackend, getStore } from "@/lib/data";

const nameSchema = z.string().trim().min(1).max(60);

/** Change the display name shown across the app. */
export async function updateName(name: string): Promise<void> {
  const user = await requireUser();
  const parsed = nameSchema.parse(name);
  const store = await getStore();
  await store.updateProfileName(user.id, parsed);
  revalidatePath("/", "layout");
}

const avatarSchema = z.string().trim().url().max(2000).or(z.literal(""));

/** Set (or clear, with "") the profile picture shown on the home header. */
export async function updateAvatar(avatarUrl: string): Promise<void> {
  const user = await requireUser();
  const parsed = avatarSchema.parse(avatarUrl);
  const store = await getStore();
  await store.updateProfileAvatar(user.id, parsed === "" ? null : parsed);
  revalidatePath("/", "layout");
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
