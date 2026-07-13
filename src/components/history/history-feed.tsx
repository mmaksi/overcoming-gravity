"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowDownUp, Clock, Loader2, Trash2 } from "lucide-react";
import { HistoryItem } from "@/lib/domain/history";
import { loadHistoryPage } from "@/lib/actions/history";
import { deleteWorkoutSession } from "@/lib/actions/runs";
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
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Delete workout ${session.date}`}
          className="shrink-0 text-muted-foreground hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="size-5" />
        </Button>
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

/**
 * Completed-workout history with infinite scroll: the server renders the
 * newest page, older pages stream in as the sentinel at the bottom comes
 * into view. Deletes are optimistic (row disappears immediately).
 */
export function HistoryFeed({
  initialItems,
  initialHasMore,
}: {
  initialItems: HistoryItem[];
  initialHasMore: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<HistoryItem | null>(null);
  // The next page's offset in the server's list. Kept separately from
  // items.length because deletions shift the list under the pagination.
  const offsetRef = useRef(initialItems.length);
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;
    const observer = new IntersectionObserver(async ([entry]) => {
      if (!entry.isIntersecting || loadingRef.current) return;
      loadingRef.current = true;
      try {
        const page = await loadHistoryPage(offsetRef.current);
        offsetRef.current += page.items.length;
        setItems((current) => {
          // Guard against overlap after deletions shifted the offset.
          const known = new Set(current.map((i) => i.id));
          return [...current, ...page.items.filter((i) => !known.has(i.id))];
        });
        setHasMore(page.hasMore);
      } finally {
        loadingRef.current = false;
      }
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore]);

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

      {hasMore && (
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
                if (!session) return;
                // The card disappears instantly; the server catches up.
                setItems((current) =>
                  current.filter((i) => i.id !== session.id),
                );
                offsetRef.current = Math.max(0, offsetRef.current - 1);
                startTransition(async () => {
                  await deleteWorkoutSession(session.id).catch(() => undefined);
                });
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
