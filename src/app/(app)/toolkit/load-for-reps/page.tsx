import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getStore } from "@/lib/data";
import { getCachedBodyweight } from "@/lib/data/cached";
import { LoadForReps } from "@/components/tools/load-for-reps";

export default async function LoadForRepsPage() {
  const user = await requireUser();
  const store = await getStore();

  // Same prefill as the 1RM calculator: weighted calisthenics can't be worked
  // out without a bodyweight, and the athlete has usually logged one already.
  const entries = await getCachedBodyweight(store, user.id);
  const latest = entries
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <Link
          href="/toolkit"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Toolkit
        </Link>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Load for target reps</h1>
          <p className="text-sm text-muted-foreground">
            Enter your one-rep max and see what to load for every rep target.
            Don&apos;t know your max?{" "}
            <Link
              href="/toolkit/one-rep-max"
              className="text-primary underline"
            >
              Estimate it first
            </Link>
            .
          </p>
        </div>
      </div>

      <LoadForReps initialBodyweight={latest?.weightKg} />

      <p className="text-xs text-muted-foreground">
        The Epley formula run backwards: load = 1RM ÷ (1 + reps ÷ 30). It&apos;s
        an estimate — treat the low rep counts as accurate and the high ones as
        a starting point to adjust from.
      </p>
    </div>
  );
}
