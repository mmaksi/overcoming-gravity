"use client";

import { useQuery } from "@tanstack/react-query";
import { loadExerciseRecords } from "@/lib/actions/history";
import { queryKeys } from "@/lib/query/keys";
import { ProgressList } from "@/components/history/progress-list";
import { Skeleton } from "@/components/ui/skeleton";
import { ONE_DAY_MS } from "@/lib/time";

/**
 * The Progress tab's content, fetched on first visit only: Radix mounts a
 * tab's content when it is first selected, so the heavy full-history read
 * never runs for users who stay on the Workouts tab. TanStack Query then keeps
 * the rows for a day (`staleTime`) and across navigations, refetching only when
 * a completed/deleted workout invalidates the `progress` key.
 */
export function ProgressTab() {
  const { data: groups } = useQuery({
    queryKey: queryKeys.progress(),
    queryFn: () => loadExerciseRecords(),
    staleTime: ONE_DAY_MS,
    gcTime: ONE_DAY_MS,
  });

  if (groups === undefined) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  return <ProgressList groups={groups} />;
}
