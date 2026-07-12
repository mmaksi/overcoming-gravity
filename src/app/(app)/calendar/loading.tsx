import { Skeleton } from "@/components/ui/skeleton";

/** Calendar skeleton: month header + grid. */
export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-11 w-24" />
      </div>
      <Skeleton className="h-80 w-full rounded-xl" />
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    </div>
  );
}
