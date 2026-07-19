"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { BookOpen, ChevronRight, ExternalLink } from "lucide-react";
import {
  Attribute,
  ATTRIBUTE_LABELS,
  ATTRIBUTES,
  CATEGORIES,
  Category,
  CATEGORY_LABELS,
  MEASUREMENT_LABELS,
} from "@/lib/domain/types";
import { Exercise, measurementOf } from "@/lib/domain/schemas";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ExpandableText } from "@/components/ui/expandable-text";
import { ExerciseThumb } from "@/components/exercise/exercise-thumb";
import { cn } from "@/lib/utils";

/** Rows rendered before any scrolling; the sentinel reveals more. */
const INITIAL_VISIBLE = 3;
/** Rows added each time the end-of-list sentinel scrolls into view. */
const LOAD_STEP = 9;

/**
 * The read-only exercise library at the bottom of the Training page: every
 * exercise in the catalog, searchable and filterable, each opening a sheet
 * with its progression ladder — images, descriptions and tutorial links.
 * Only a few rows render up front; scrolling (or narrowing the search)
 * brings in the rest, keeping the page light.
 */
export function ExerciseLibrary({ exercises }: { exercises: Exercise[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | null>(null);
  const [attribute, setAttribute] = useState<Attribute | null>(null);
  const [openExercise, setOpenExercise] = useState<Exercise | null>(null);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const filtered = useMemo(
    () =>
      exercises.filter((e) => {
        if (category && e.category !== category) return false;
        if (attribute && e.attribute !== attribute) return false;
        if (query && !e.title.toLowerCase().includes(query.toLowerCase()))
          return false;
        return true;
      }),
    [exercises, category, attribute, query],
  );

  // A new search starts small again — results grow on scroll like the
  // unfiltered list. Reset during render (not in an effect) so the shrunk
  // list paints in the same pass as the filter change.
  const filterKey = `${query}|${category}|${attribute}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setVisibleCount(INITIAL_VISIBLE);
  }

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleCount((n) => n + LOAD_STEP);
        }
      },
      // Start loading a bit before the sentinel is actually on screen.
      { rootMargin: "300px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  const visible = filtered.slice(0, visibleCount);

  return (
    <section className="space-y-3 border-t pt-6">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <BookOpen className="size-5 text-primary" /> Exercise library
        </h2>
        <p className="text-sm text-muted-foreground">
          Browse every exercise and its progressions — tap one for the full
          ladder.
        </p>
      </div>

      <Input
        placeholder="Search exercises…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((c) => (
          <FilterChip
            key={c}
            label={CATEGORY_LABELS[c]}
            active={category === c}
            onClick={() => setCategory(category === c ? null : c)}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {ATTRIBUTES.map((a) => (
          <FilterChip
            key={a}
            label={ATTRIBUTE_LABELS[a]}
            active={attribute === a}
            onClick={() => setAttribute(attribute === a ? null : a)}
          />
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No exercises match.
        </p>
      ) : (
        <div className="space-y-2">
          {visible.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => setOpenExercise(e)}
              className="flex w-full items-center gap-3 rounded-xl bg-muted/50 p-3 text-left transition-colors hover:bg-muted"
            >
              <ExerciseThumb title={e.title} imageUrl={e.imageUrl} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{e.title}</span>
                  <Badge variant="outline" className="shrink-0">
                    {CATEGORY_LABELS[e.category]}
                  </Badge>
                </div>
                <p className="line-clamp-1 text-sm text-muted-foreground">
                  {e.progressions.length}{" "}
                  {e.progressions.length === 1 ? "progression" : "progressions"}
                  {" · "}
                  {e.progressions.map((p) => p.name).join(" → ")}
                </p>
              </div>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}

      {/* Always mounted so the observer survives filter changes; it only
          reads as "more below" while rows remain hidden. */}
      <div ref={sentinelRef}>
        {filtered.length > visible.length && (
          <p className="py-1 text-center text-xs text-muted-foreground">
            Showing {visible.length} of {filtered.length} — scroll for more
          </p>
        )}
      </div>

      {/* One sheet, remounted per exercise so scroll and expanders reset. */}
      <ExerciseDetailSheet
        key={openExercise?.id}
        exercise={openExercise}
        onOpenChange={(open) => {
          if (!open) setOpenExercise(null);
        }}
      />
    </section>
  );
}

/**
 * The full progression ladder of one exercise, easiest first. Fixed at 2/3
 * of the screen height for every exercise — the content scrolls inside.
 */
function ExerciseDetailSheet({
  exercise,
  onOpenChange,
}: {
  exercise: Exercise | null;
  onOpenChange: (open: boolean) => void;
}) {
  if (!exercise) return null;
  return (
    <Sheet open onOpenChange={onOpenChange}>
      {/* The base sheet sets data-[side=bottom]:h-auto; override at the SAME
          variant so tailwind-merge drops h-auto and the height stays fixed
          no matter how much one exercise contains. */}
      <SheetContent
        side="bottom"
        className="data-[side=bottom]:h-[66dvh] max-h-[75dvh] overflow-hidden p-0"
      >
        <div className="flex h-full min-h-0 flex-col">
          <SheetHeader>
            <SheetTitle>{exercise.title}</SheetTitle>
            <SheetDescription>
              {CATEGORY_LABELS[exercise.category]} ·{" "}
              {ATTRIBUTE_LABELS[exercise.attribute]} ·{" "}
              {exercise.progressions.length}{" "}
              {exercise.progressions.length === 1
                ? "progression"
                : "progressions"}
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 pb-8">
            <LibraryImage src={exercise.imageUrl} alt={exercise.title} />

            {exercise.progressions.map((p, i) => (
              <div key={p.id} className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {p.name}
                  </span>
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    {MEASUREMENT_LABELS[measurementOf(exercise, p.id)]}
                  </Badge>
                </div>
                <LibraryImage
                  src={p.imageUrl}
                  alt={`${exercise.title} — ${p.name}`}
                />
                {p.description && <ExpandableText text={p.description} />}
                {p.videoUrl && (
                  <a
                    href={p.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary"
                  >
                    Watch tutorial <ExternalLink className="size-3.5" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * An optimized illustration inside the detail sheet: fixed frame, contained
 * image, lazy-loaded and resized by the image optimizer (https-only, like
 * the thumbnail). Renders nothing without a usable URL.
 */
function LibraryImage({ src, alt }: { src?: string; alt: string }) {
  if (!src?.startsWith("https://")) return null;
  return (
    <div className="relative h-56 w-full overflow-hidden rounded-lg border bg-muted">
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 640px) 100vw, 640px"
        className="object-contain"
      />
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "text-muted-foreground hover:border-foreground/30",
      )}
    >
      {label}
    </button>
  );
}
