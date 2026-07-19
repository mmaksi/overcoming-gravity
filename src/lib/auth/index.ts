import "server-only";
import { cookies } from "next/headers";
import { Profile } from "@/lib/domain/schemas";
import { dataBackend } from "@/lib/data";

export const MOCK_ADMIN_COOKIE = "strong-journal-mock-admin";

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
  // Read the profile so a name change in Settings shows up in dev too.
  const { getStore } = await import("@/lib/data");
  const profile = await (await getStore()).getProfile("dev-athlete");
  return {
    id: "dev-athlete",
    email: profile?.email ?? "athlete@dev.local",
    name: profile?.name ?? "Dev Athlete",
    isAdmin,
    avatarUrl: profile?.avatarUrl,
    heightCm: profile?.heightCm,
    targetWeightKg: profile?.targetWeightKg,
    // Dev profiles created before the tours existed have no flags stored.
    showWelcome: profile?.showWelcome ?? true,
    showDesignerIntro: profile?.showDesignerIntro ?? true,
    plan: profile?.plan ?? "free",
    planInterval: profile?.planInterval,
    planRenewsAt: profile?.planRenewsAt,
    planCancelAtPeriodEnd: profile?.planCancelAtPeriodEnd ?? false,
    billingProvider: profile?.billingProvider,
    billingCustomerId: profile?.billingCustomerId,
    hadSubscription: profile?.hadSubscription ?? false,
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
