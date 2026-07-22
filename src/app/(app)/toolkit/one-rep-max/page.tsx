import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getStore } from "@/lib/data";
import { getCachedBodyweight } from "@/lib/data/cached";
import { OneRepMax } from "@/components/tools/one-rep-max";

export default async function OneRepMaxPage() {
  const user = await requireUser();
  const store = await getStore();

  // Prefill the weighted-calisthenics bodyweight field with the athlete's most
  // recent weigh-in, if they've logged one.
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
          <h1 className="text-2xl font-bold">1 rep max calculator</h1>
          <p className="text-sm text-muted-foreground">
            Estimate your one-rep max from a set you can do for multiple reps.
            For weighted calisthenics, your total weight is your bodyweight plus
            any added load.
          </p>
        </div>
      </div>

      <OneRepMax initialBodyweight={latest?.weightKg} />

      <p className="text-xs text-muted-foreground">
        Uses the Epley formula: 1RM = total weight × (1 + reps ÷ 30). It&apos;s
        an estimate — accuracy is best at lower rep counts.
      </p>
    </div>
  );
}
