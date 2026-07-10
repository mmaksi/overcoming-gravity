"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { MOCK_ADMIN_COOKIE } from "@/lib/auth";
import { dataBackend } from "@/lib/data";

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
