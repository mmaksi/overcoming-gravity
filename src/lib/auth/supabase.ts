import "server-only";
import { planFromStatus, Profile } from "@/lib/domain/schemas";

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
  const { data: profile, error } = await supabase
    .from("profiles")
    .select(
      "id, email, name, is_admin, avatar_url, height_cm, target_weight_kg, show_welcome, show_designer_intro, subscription_status, subscription_interval, subscription_period_end, subscription_cancel_at_period_end, billing_provider, billing_customer_id, billing_subscription_id",
    )
    .eq("id", user.id)
    .single();
  // The fallback below masks a broken query (e.g. schema drift: a selected
  // column missing in the database) — make that failure visible in the logs.
  if (error) console.error("profiles query failed:", error.message);
  if (!profile) {
    return {
      id: user.id,
      email: user.email ?? undefined,
      name: user.email ?? "Athlete",
      isAdmin: false,
      showWelcome: true,
      showDesignerIntro: true,
      plan: "free",
      planCancelAtPeriodEnd: false,
      hadSubscription: false,
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
    showDesignerIntro: profile.show_designer_intro ?? true,
    plan: planFromStatus(profile.subscription_status),
    planInterval:
      profile.subscription_interval === "month" ||
      profile.subscription_interval === "year"
        ? profile.subscription_interval
        : undefined,
    planRenewsAt: profile.subscription_period_end ?? undefined,
    planCancelAtPeriodEnd: profile.subscription_cancel_at_period_end ?? false,
    billingProvider: profile.billing_provider ?? undefined,
    billingCustomerId: profile.billing_customer_id ?? undefined,
    // A stored subscription id/status survives cancellation (only wiped when
    // the provider reports no subscription at all).
    hadSubscription:
      profile.billing_subscription_id != null ||
      profile.subscription_status != null,
  };
}
