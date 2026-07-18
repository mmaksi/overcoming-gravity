"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Lock, Plus } from "lucide-react";
import { PaywallDialog } from "@/components/billing/paywall";

const CTA_CLASSES =
  "group flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-4 text-left transition-colors hover:border-primary hover:bg-primary/10";

/**
 * The Programs page's "Create a program" call-to-action. Free accounts get
 * the same inviting card, but tapping it opens the paywall instead of the
 * wizard (the designer is a full-app feature; the server action backstops).
 */
export function CreateProgramCta({ locked }: { locked: boolean }) {
  const [paywallOpen, setPaywallOpen] = useState(false);

  const body = (
    <>
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary transition-transform group-hover:scale-105">
        {locked ? <Lock className="size-5" /> : <Plus className="size-6" />}
      </span>
      <span className="min-w-0">
        <span className="block font-semibold">Create a program</span>
        <span className="block text-sm text-muted-foreground">
          Pick a type, choose your skills, design the mesocycle.
        </span>
      </span>
      <ChevronRight className="ml-auto size-5 shrink-0 text-muted-foreground" />
    </>
  );

  if (!locked) {
    return (
      <Link href="/programs/new" className={CTA_CLASSES}>
        {body}
      </Link>
    );
  }
  return (
    <>
      <button
        type="button"
        onClick={() => setPaywallOpen(true)}
        className={CTA_CLASSES}
      >
        {body}
      </button>
      <PaywallDialog
        open={paywallOpen}
        onOpenChange={setPaywallOpen}
        feature="The program designer"
      />
    </>
  );
}
