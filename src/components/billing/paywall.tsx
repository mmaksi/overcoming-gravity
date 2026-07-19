"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { BadgePercent, Check, Loader2, Lock, Sparkles } from "lucide-react";
import { startCheckout, previewVoucher } from "@/lib/actions/billing";
import {
  ANNUAL_SAVINGS_EUR,
  PLAN_PRICING,
  PlanInterval,
  TRIAL_DAYS,
} from "@/lib/billing/entitlements";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** What paying unlocks — shared by the dialog and the full-page panel. */
const PRO_FEATURES = [
  "Design unlimited training programs with full mesocycle control",
  "Unlimited individual workouts",
  "Periodization, deload weeks and goal tracking",
  "Live cardio modes: pyramid, ladder, HIIT and Tabata runners",
];

/** "€25" for whole euros, "€18.75" otherwise. */
function euros(amount: number): string {
  return `€${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;
}

/**
 * A plan's price with the trial leading: people read the number first, so
 * the big figure is €0 and the real price follows in smaller text. While a
 * voucher is applied, the discounted first payment shows next to the
 * struck-through full price.
 */
function PriceTag({
  interval,
  percentOff,
  showTrial,
}: {
  interval: PlanInterval;
  percentOff?: number;
  showTrial: boolean;
}) {
  const full = PLAN_PRICING[interval].amountEur;
  const discounted =
    percentOff === undefined ? null : full * (1 - percentOff / 100);
  if (!showTrial) {
    // Returning subscribers get no second trial — the real price leads.
    return (
      <>
        <span className="block text-2xl font-bold tabular-nums">
          {euros(full)}
        </span>
        <span className="block text-xs text-muted-foreground">
          {PLAN_PRICING[interval].suffix.slice(1)}
        </span>
        {discounted !== null && (
          <span className="block text-xs font-medium tabular-nums text-primary">
            {euros(discounted)} first payment
          </span>
        )}
      </>
    );
  }
  return (
    <>
      <span className="block text-2xl font-bold tabular-nums">€0</span>
      <span className="block text-xs text-muted-foreground">
        {`free for ${TRIAL_DAYS} days, then`}
      </span>
      <span className="block text-xs font-medium tabular-nums">
        {discounted !== null && (
          <span className="mr-1 font-normal text-muted-foreground line-through">
            {euros(full)}
          </span>
        )}
        {discounted !== null
          ? `${euros(discounted)} first payment, then ${euros(full)}${PLAN_PRICING[interval].suffix}`
          : `${euros(full)}${PLAN_PRICING[interval].suffix}`}
      </span>
    </>
  );
}

/**
 * The two subscription offers (pick one, then "Unlock now") with an
 * optional voucher input, ending in a hosted checkout. Used inside
 * PaywallDialog and on the /programs/new upgrade panel. Navigation happens
 * after awaiting the action (external URL, so window.location — not
 * router.push).
 */
export function PlanCards({
  showTrial = true,
  showFeatures = true,
}: {
  /** Off for lapsed subscribers — they already used their trial. */
  showTrial?: boolean;
  /** Off where the surrounding page already spells out what's locked. */
  showFeatures?: boolean;
} = {}) {
  const [voucherCode, setVoucherCode] = useState("");
  const [applied, setApplied] = useState<{
    code: string;
    percentOff: number;
  } | null>(null);
  const [voucherMessage, setVoucherMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Tapping a card only selects it — checkout starts from the CTA below,
  // so switching plans is free. Annual is preselected as the best value.
  const [interval, setInterval] = useState<PlanInterval>("year");

  const checkoutMutation = useMutation({ mutationFn: startCheckout });
  const voucherMutation = useMutation({ mutationFn: previewVoucher });

  function unlock() {
    setError(null);
    checkoutMutation
      .mutateAsync({ interval, voucherCode: applied?.code })
      .then((url) => window.location.assign(url))
      .catch((e: Error) =>
        setError(e.message || "Could not start the checkout — try again."),
      );
  }

  function applyVoucher() {
    setVoucherMessage(null);
    voucherMutation
      .mutateAsync(voucherCode)
      .then((result) => {
        if ("percentOff" in result) {
          setApplied({ code: voucherCode.trim(), percentOff: result.percentOff });
        } else {
          setApplied(null);
          setVoucherMessage(result.problem);
        }
      })
      .catch(() => setVoucherMessage("Could not check the code — try again."));
  }

  const pending = checkoutMutation.isPending;

  return (
    <div className="space-y-4">
      {showFeatures && (
        <ul className="space-y-1.5">
          {PRO_FEATURES.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Trial promise, mirrored server-side in startCheckout (TRIAL_DAYS,
          first-time subscribers only). */}
      {showTrial && (
        <p className="rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
          {`Try everything free for ${TRIAL_DAYS} days — you won't be charged until the trial ends, and cancelling keeps you on the free plan.`}
        </p>
      )}

      <div role="radiogroup" aria-label="Subscription plan" className="space-y-2">
        {/* Annual first and preselected as the best value. */}
        <button
          type="button"
          role="radio"
          aria-checked={interval === "year"}
          disabled={pending}
          onClick={() => setInterval("year")}
          className={`relative w-full rounded-xl border-2 p-4 text-left transition-colors disabled:opacity-70 ${
            interval === "year"
              ? "border-primary bg-primary/5"
              : "border-border hover:border-foreground/30"
          }`}
        >
          <span className="absolute -top-2.5 right-3 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">
            Best value — save €{ANNUAL_SAVINGS_EUR}
          </span>
          <span className="flex items-center justify-between gap-2">
            <span>
              <span className="flex items-center gap-1.5 font-semibold">
                <Sparkles className="size-4 text-primary" />
                {PLAN_PRICING.year.label}
              </span>
              <span className="text-sm text-muted-foreground">
                Two months on the house.
              </span>
            </span>
            <span className="text-right">
              <PriceTag
                interval="year"
                percentOff={applied?.percentOff}
                showTrial={showTrial}
              />
            </span>
          </span>
        </button>

        <button
          type="button"
          role="radio"
          aria-checked={interval === "month"}
          disabled={pending}
          onClick={() => setInterval("month")}
          className={`w-full rounded-xl border-2 p-4 text-left transition-colors disabled:opacity-70 ${
            interval === "month"
              ? "border-primary bg-primary/5"
              : "border-border hover:border-foreground/30"
          }`}
        >
          <span className="flex items-center justify-between gap-2">
            <span>
              <span className="block font-semibold">
                {PLAN_PRICING.month.label}
              </span>
              <span className="text-sm text-muted-foreground">
                Cancel any time.
              </span>
            </span>
            <span className="text-right">
              <PriceTag
                interval="month"
                percentOff={applied?.percentOff}
                showTrial={showTrial}
              />
            </span>
          </span>
        </button>
      </div>

      {/* Voucher entry: validated against the app's own codes. */}
      {applied ? (
        <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
          <BadgePercent className="size-4" />
          {applied.code.toUpperCase()} applied — {applied.percentOff}% off your
          first payment
        </p>
      ) : (
        <div className="space-y-1">
          <div className="flex gap-2">
            <Input
              placeholder="Voucher code"
              value={voucherCode}
              onChange={(e) => setVoucherCode(e.target.value)}
              className="uppercase placeholder:normal-case"
            />
            <Button
              variant="outline"
              disabled={voucherMutation.isPending || voucherCode.trim() === ""}
              onClick={applyVoucher}
            >
              {voucherMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Apply"
              )}
            </Button>
          </div>
          {voucherMessage && (
            <p className="text-sm text-muted-foreground">{voucherMessage}</p>
          )}
        </div>
      )}

      <Button size="lg" className="w-full" disabled={pending} onClick={unlock}>
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <>
            <Lock className="size-4" /> Unlock now
          </>
        )}
      </Button>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">
        Secure payment — you can manage or cancel your plan in Settings.
      </p>
    </div>
  );
}

/** Modal paywall, opened when a locked feature is tapped. */
export function PaywallDialog({
  open,
  onOpenChange,
  feature,
  showTrial = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** e.g. "The program designer" — leads the dialog copy. */
  feature: string;
  /** Off for lapsed subscribers — they already used their trial. */
  showTrial?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="size-5 text-primary" /> Unlock the full app
          </DialogTitle>
          <DialogDescription>
            {feature} is part of the full Strong Journal experience.
          </DialogDescription>
        </DialogHeader>
        <PlanCards showTrial={showTrial} />
      </DialogContent>
    </Dialog>
  );
}
