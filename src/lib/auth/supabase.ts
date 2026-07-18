import "server-only";
import { Profile } from "@/lib/domain/schemas";

/**
 * Supabase-backed auth (production). Reads the session from cookies via
 * @supabase/ssr and resolves the profile row.
 */
export async function getSupabaseUser(): Promise<Profile | null> {
  const { createServerSupabase } = await import("@/lib/supabase/server");
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, email, name, is_admin, avatar_url, height_cm, target_weight_kg, show_welcome",
    )
    .eq("id", user.id)
    .single();
  if (!profile) {
    return {
      id: user.id,
      email: user.email ?? undefined,
      name: user.email ?? "Athlete",
      isAdmin: false,
      showWelcome: true,
    };
  }
  return {
    id: profile.id,
    email: profile.email ?? undefined,
    name: profile.name ?? user.email ?? "Athlete",
    isAdmin: profile.is_admin,
    avatarUrl: profile.avatar_url ?? undefined,
    heightCm: profile.height_cm ?? undefined,
    targetWeightKg: profile.target_weight_kg ?? undefined,
    showWelcome: profile.show_welcome ?? true,
  };
}
