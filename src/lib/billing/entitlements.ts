/**
 * What each plan is allowed to do, plus the public pricing. Client-safe (no
 * provider SDKs) so paywall UI and server actions share one source of truth.
 */

export const FREE_CUSTOM_WORKOUT_LIMIT = 2;

/** Days a first-time subscriber tries the full app before being charged. */
export const TRIAL_DAYS = 3;

/** Admins always have full access; everyone else needs a live subscription. */
export function isPro(user: { plan: "free" | "pro"; isAdmin: boolean }): boolean {
  return user.isAdmin || user.plan === "pro";
}

export type PlanInterval = "month" | "year";

export const PLAN_PRICING: Record<
  PlanInterval,
  { amountEur: number; label: string; suffix: string }
> = {
  month: { amountEur: 25, label: "Monthly", suffix: "/month" },
  year: { amountEur: 197, label: "Annual", suffix: "/year" },
};

/** What the annual plan saves against 12 months of monthly. */
export const ANNUAL_SAVINGS_EUR =
  PLAN_PRICING.month.amountEur * 12 - PLAN_PRICING.year.amountEur;
