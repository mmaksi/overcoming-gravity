"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Home, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** A few on-brand messages so an error still feels like part of the app. */
const MESSAGES = [
  {
    code: "500",
    title: "Form Check Failed",
    body: "The set didn't count — something gave out mid-rep. Re-rack and try again.",
  },
  {
    code: "DOMS",
    title: "This Page Pulled a Muscle",
    body: "It needs a second to recover. Give it another go.",
  },
  {
    code: "AMRAP",
    title: "As Many Retries As Possible",
    body: "That rep failed, but you've got more in the tank. Try again.",
  },
];

export default function AppError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // Surface for logging/monitoring in production.
    console.error(error);
  }, [error]);

  // Session expiry throws "Not authenticated" — send them to sign in instead.
  const isAuth = /not authenticated|unauthorized|auth/i.test(error.message);

  // Stable pick derived from the error itself (no impure Math.random in render).
  const seed = error.digest ?? error.message ?? "";
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  const pick = MESSAGES[Math.abs(hash) % MESSAGES.length];

  if (isAuth) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-6 px-6 text-center">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Your session cooled down</h1>
          <p className="text-muted-foreground">
            You were away long enough that we logged you out. Sign back in to
            pick up where you left off — your workout is saved.
          </p>
        </div>
        <Button asChild size="lg">
          <Link href="/login">Sign back in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="space-y-2">
        <p className="text-4xl font-black">{pick.code}</p>
        <h1 className="text-2xl font-bold">{pick.title}</h1>
        <p className="text-muted-foreground">{pick.body}</p>
      </div>
      <div className="flex flex-col gap-2">
        <Button size="lg" onClick={() => unstable_retry()}>
          <RotateCcw className="size-4" /> Try again
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/">
            <Home className="size-4" /> Back to base
          </Link>
        </Button>
      </div>
    </div>
  );
}
