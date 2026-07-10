import { Skeleton } from "@/components/ui/skeleton";

/** Workout logger skeleton: title, meta line, then exercise blocks. */
export default function Loading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-7 w-52" />
      <Skeleton className="h-5 w-64" />
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="space-y-3 py-2">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-3/4" />
        </div>
      ))}
    </div>
  );
}
