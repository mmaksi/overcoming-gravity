"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { BadgeCheck, CreditCard, Loader2, Sparkles } from "lucide-react";
import { openBillingManagement } from "@/lib/actions/billing";
import {
  FREE_CUSTOM_WORKOUT_LIMIT,
  PLAN_PRICING,
  PlanInterval,
} from "@/lib/billing/entitlements";
import { PaywallDialog } from "@/components/billing/paywall";
import { Button } from "@/components/ui/button";

/**
 * The Settings "Plan" card body: what you're on, and the door to change it.
 * Card and subscription management happen on the provider's hosted portal —
 * the app never touches payment details.
 */
export function BillingSection({
  isAdmin,
  plan,
  planInterval,
  planRenewsAt,
  planCancelAtPeriodEnd,
  justUpgraded,
}: {
  isAdmin: boolean;
  plan: "free" | "pro";
  planInterval?: PlanInterval;
  planRenewsAt?: string;
  planCancelAtPeriodEnd: boolean;
  /** True right after a successful checkout redirect — show a welcome. */
  justUpgraded: boolean;
}) {
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const manageMutation = useMutation({ mutationFn: openBillingManagement });

  function manage() {
    setError(null);
    manageMutation
      .mutateAsync()
      .then((url) => window.location.assign(url))
      .catch((e: Error) =>
        setError(e.message || "Could not open the billing portal."),
      );
  }

  if (isAdmin) {
    return (
      <p className="flex items-center gap-2 text-sm">
        <BadgeCheck className="size-4 text-primary" />
        Admin account — full access included.
      </p>
    );
  }

  if (plan === "pro") {
    const renewDate = planRenewsAt?.slice(0, 10);
    return (
      <div className="space-y-3">
        {justUpgraded && (
          <p className="rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
            Payment received — welcome to the full app!
          </p>
        )}
        <p className="flex items-center gap-2 text-sm">
          <Sparkles className="size-4 text-primary" />
          <span>
            <span className="font-semibold">Strong Journal</span>
            {planInterval && (
              <>
                {" "}
                · €{PLAN_PRICING[planInterval].amountEur}
                {PLAN_PRICING[planInterval].suffix}
              </>
            )}
            {renewDate && (
              <span className="text-muted-foreground">
                {" "}
                · {planCancelAtPeriodEnd ? "ends" : "renews"} {renewDate}
              </span>
            )}
          </span>
        </p>
        <Button
          variant="outline"
          onClick={manage}
          disabled={manageMutation.isPending}
        >
          {manageMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>
              <CreditCard className="size-4" /> Manage subscription
            </>
          )}
        </Button>
        <p className="text-xs text-muted-foreground">
          Change your card, switch plans or cancel — handled on the secure
          billing portal.
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm">
        <span className="font-semibold">Free plan</span>
        <span className="text-muted-foreground">
          {" "}
          · log workouts and keep {FREE_CUSTOM_WORKOUT_LIMIT} custom workouts.
          The program designer and unlimited workouts are part of the full
          app.
        </span>
      </p>
      <Button onClick={() => setPaywallOpen(true)}>
        <Sparkles className="size-4" /> Upgrade
      </Button>
      <PaywallDialog
        open={paywallOpen}
        onOpenChange={setPaywallOpen}
        feature="Everything beyond the free plan"
      />
    </div>
  );
}
