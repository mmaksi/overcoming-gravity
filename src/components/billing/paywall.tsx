"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { BadgePercent, Check, Loader2, Lock, Sparkles } from "lucide-react";
import { startCheckout, previewVoucher } from "@/lib/actions/billing";
import {
  ANNUAL_SAVINGS_EUR,
  PLAN_PRICING,
  PlanInterval,
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

/**
 * The two subscription offers with an optional voucher input, ending in a
 * hosted checkout. Used inside PaywallDialog and on the /programs/new
 * upgrade panel. Navigation happens after awaiting the action (external
 * URL, so window.location — not router.push).
 */
export function PlanCards() {
  const [voucherCode, setVoucherCode] = useState("");
  const [applied, setApplied] = useState<{
    code: string;
    percentOff: number;
  } | null>(null);
  const [voucherMessage, setVoucherMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<PlanInterval | null>(null);

  const checkoutMutation = useMutation({ mutationFn: startCheckout });
  const voucherMutation = useMutation({ mutationFn: previewVoucher });

  function choose(interval: PlanInterval) {
    setError(null);
    setChosen(interval);
    checkoutMutation
      .mutateAsync({ interval, voucherCode: applied?.code })
      .then((url) => window.location.assign(url))
      .catch((e: Error) => {
        setChosen(null);
        setError(e.message || "Could not start the checkout — try again.");
      });
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
      <ul className="space-y-1.5">
        {PRO_FEATURES.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <div className="space-y-2">
        {/* Annual first and visually recommended. */}
        <button
          type="button"
          disabled={pending}
          onClick={() => choose("year")}
          className="relative w-full rounded-xl border-2 border-primary bg-primary/5 p-4 text-left transition-colors hover:bg-primary/10 disabled:opacity-70"
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
              {pending && chosen === "year" ? (
                <Loader2 className="size-5 animate-spin text-primary" />
              ) : (
                <>
                  <span className="block text-2xl font-bold tabular-nums">
                    €{PLAN_PRICING.year.amountEur}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {PLAN_PRICING.year.suffix}
                  </span>
                </>
              )}
            </span>
          </span>
        </button>

        <button
          type="button"
          disabled={pending}
          onClick={() => choose("month")}
          className="w-full rounded-xl border p-4 text-left transition-colors hover:border-foreground/30 disabled:opacity-70"
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
              {pending && chosen === "month" ? (
                <Loader2 className="size-5 animate-spin text-primary" />
              ) : (
                <>
                  <span className="block text-2xl font-bold tabular-nums">
                    €{PLAN_PRICING.month.amountEur}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {PLAN_PRICING.month.suffix}
                  </span>
                </>
              )}
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** e.g. "The program designer" — leads the dialog copy. */
  feature: string;
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
        <PlanCards />
      </DialogContent>
    </Dialog>
  );
}
