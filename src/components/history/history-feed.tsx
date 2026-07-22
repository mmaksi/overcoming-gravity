"use client";

import { useEffect, useRef, useState } from "react";
import {
  InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import Link from "next/link";
import { ArrowDownUp, Clock, Loader2, Pencil, Trash2 } from "lucide-react";
import { HistoryItem } from "@/lib/domain/history";
import { loadHistoryPage } from "@/lib/actions/history";
import { deleteWorkoutSession } from "@/lib/actions/runs";
import { queryKeys } from "@/lib/query/keys";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 rounded-lg bg-muted/60 px-2 py-1.5 text-center">
      <div className="text-sm font-bold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

/** One completed workout: stats strip over a two-column exercise table. */
function HistoryCard({
  session,
  onDelete,
}: {
  session: HistoryItem;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-2xl border p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{session.date}</span>
            <Badge variant="secondary">{session.label}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">{session.meta}</p>
        </div>
        <div className="flex shrink-0 items-center">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-primary"
          >
            <Link
              href={`/workout/${session.id}?edit=1`}
              aria-label={`Edit workout ${session.date}`}
            >
              <Pencil className="size-5" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Delete workout ${session.date}`}
            className="text-muted-foreground hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="size-5" />
          </Button>
        </div>
      </div>

      {/* Stats strip: duration + push/pull volume. */}
      <div className="mt-3 flex gap-2">
        {session.duration && (
          <div className="flex-1 rounded-lg bg-muted/60 px-2 py-1.5 text-center">
            <div className="flex items-center justify-center gap-1 text-sm font-bold tabular-nums">
              <Clock className="size-3.5 text-primary" />
              {session.duration}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Duration
            </div>
          </div>
        )}
        <Stat label="Push vol" value={`${session.pushVolume}`} />
        <Stat label="Pull vol" value={`${session.pullVolume}`} />
      </div>

      {/* Exercise table. */}
      <Link
        href={`/workout/${session.id}`}
        className="mt-3 block overflow-hidden rounded-lg border"
      >
        <table className="w-full text-sm">
          <tbody>
            {session.lines.map((line, i) => (
              <tr key={line.id} className={i > 0 ? "border-t" : undefined}>
                <td className="px-3 py-2 font-medium">
                  <span className="flex items-center gap-1.5">
                    {line.title}
                    {line.method && (
                      <Badge className="text-[10px]">
                        <ArrowDownUp className="size-3" />
                        {line.method}
                      </Badge>
                    )}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {line.sets}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Link>
    </div>
  );
}

type HistoryPage = { items: HistoryItem[]; hasMore: boolean };

/**
 * Completed-workout history with infinite scroll, backed by TanStack Query.
 * The server renders the newest page (seeded here as `initialData`), older
 * pages stream in as the sentinel comes into view. The cache never goes stale
 * on its own (`staleTime: Infinity`) — only completing a workout (see the
 * workout logger) or deleting one here refreshes it. Deletes are optimistic:
 * the row disappears immediately and rolls back if the server rejects it.
 *
 * The next page's offset is the running total of items currently cached, so an
 * optimistic delete (which shrinks both the cache and the server's list by one)
 * keeps pagination aligned without a separate offset counter.
 */
export function HistoryFeed({
  initialItems,
  initialHasMore,
}: {
  initialItems: HistoryItem[];
  initialHasMore: boolean;
}) {
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState<HistoryItem | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: queryKeys.history(),
      queryFn: ({ pageParam }) => loadHistoryPage(pageParam),
      initialPageParam: 0,
      getNextPageParam: (lastPage, allPages) =>
        lastPage.hasMore
          ? allPages.reduce((n, p) => n + p.items.length, 0)
          : undefined,
      initialData: {
        pages: [{ items: initialItems, hasMore: initialHasMore }],
        pageParams: [0],
      },
      staleTime: Infinity,
      gcTime: Infinity,
    });

  const items = data.pages.flatMap((p) => p.items);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteWorkoutSession(id),
    // Optimistically drop the row; the running-total offset above stays correct
    // because the server's list shrinks by the same one on the next fetch.
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.history() });
      const previous = queryClient.getQueryData<InfiniteData<HistoryPage>>(
        queryKeys.history(),
      );
      queryClient.setQueryData<InfiniteData<HistoryPage>>(
        queryKeys.history(),
        (old) =>
          old && {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.filter((i) => i.id !== id),
            })),
          },
      );
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.history(), context.previous);
      }
    },
    // Progress rows aggregate this workout's volume, so they must recompute.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.progress() });
    },
  });

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasNextPage) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !isFetchingNextPage) fetchNextPage();
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (items.length === 0) {
    return (
      <div className="space-y-1 py-8 text-center">
        <p className="font-medium">No workouts yet</p>
        <p className="text-sm text-muted-foreground">
          Completed workouts appear here with everything you logged.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {items.map((session) => (
          <HistoryCard
            key={session.id}
            session={session}
            onDelete={() => setConfirm(session)}
          />
        ))}
      </div>

      {hasNextPage && (
        <div ref={sentinelRef} className="flex justify-center py-4">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}

      <Dialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this workout?</DialogTitle>
            <DialogDescription>
              The logged workout from {confirm?.date} is permanently removed
              from your history and progress stats.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={() => {
                const session = confirm;
                setConfirm(null);
                if (session) deleteMutation.mutate(session.id);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
