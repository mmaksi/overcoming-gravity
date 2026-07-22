"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Medal } from "lucide-react";
import { loadExerciseRecords } from "@/lib/actions/history";
import { queryKeys } from "@/lib/query/keys";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ONE_DAY_MS } from "@/lib/time";

/**
 * A Stats-section card: how many personal records the athlete holds (one per
 * trained skill/strength progression), linking to the Progress tab's full
 * list. Shares the `progress` query with that tab, so opening it is instant —
 * and completing a workout invalidates the key, refreshing both at once.
 */
export function RecordsCard() {
  const { data: groups } = useQuery({
    queryKey: queryKeys.progress(),
    queryFn: () => loadExerciseRecords(),
    staleTime: ONE_DAY_MS,
    gcTime: ONE_DAY_MS,
  });

  const count = groups?.reduce((n, g) => n + g.records.length, 0);

  return (
    <Link href="/calendar?tab=progress" className="block">
      <Card className="gap-2 py-4 transition-colors hover:border-primary/50">
        <CardHeader className="px-4">
          <CardTitle className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5">
              <Medal className="size-4 text-primary" /> Personal Records
            </span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4">
          <div className="flex items-baseline gap-1.5">
            {count === undefined ? (
              <Skeleton className="h-9 w-10" />
            ) : (
              <span className="text-3xl font-bold tabular-nums">{count}</span>
            )}
            <span className="text-sm font-medium text-muted-foreground">
              all-time
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {count === 0
              ? "Log a skill or strength workout to set your first."
              : ""}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
