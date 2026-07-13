"use client";

import { useEffect, useState } from "react";
import { loadProgressRows } from "@/lib/actions/history";
import { ProgressList, ProgressRow } from "@/components/history/progress-list";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The Progress tab's content, fetched on first visit only: Radix mounts a
 * tab's content when it is first selected, so the heavy full-history read
 * never runs for users who stay on the Workouts tab.
 */
export function ProgressTab() {
  const [rows, setRows] = useState<ProgressRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadProgressRows()
      .then((loaded) => {
        if (!cancelled) setRows(loaded);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (rows === null) {
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

  return <ProgressList rows={rows} />;
}
