import "server-only";
import { cookies } from "next/headers";
import { Profile } from "@/lib/domain/schemas";
import { dataBackend } from "@/lib/data";

export const MOCK_ADMIN_COOKIE = "cali-mock-admin";

/**
 * Auth seam mirroring the DataStore seam: mock session in development
 * (always signed in as the dev athlete, admin toggled by cookie), Supabase
 * Auth in production.
 */
export async function getCurrentUser(): Promise<Profile | null> {
  if (dataBackend() === "supabase") {
    const { getSupabaseUser } = await import("./supabase");
    return getSupabaseUser();
  }
  const jar = await cookies();
  const isAdmin = jar.get(MOCK_ADMIN_COOKIE)?.value === "1";
  return {
    id: "dev-athlete",
    email: "athlete@dev.local",
    name: "Dev Athlete",
    isAdmin,
  };
}

export async function requireUser(): Promise<Profile> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

export async function requireAdmin(): Promise<Profile> {
  const user = await requireUser();
  if (!user.isAdmin) throw new Error("Not authorized");
  return user;
}
