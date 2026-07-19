"use client";

import { useMemo, useState } from "react";
import { ChevronRight, ExternalLink } from "lucide-react";
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

/**
 * The read-only exercise library at the bottom of the Training page: every
 * exercise in the catalog, searchable and filterable, each opening a sheet
 * with its progression ladder — images, descriptions and tutorial links.
 */
export function ExerciseLibrary({ exercises }: { exercises: Exercise[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | null>(null);
  const [attribute, setAttribute] = useState<Attribute | null>(null);
  const [openExercise, setOpenExercise] = useState<Exercise | null>(null);

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

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-bold">Exercise library</h2>
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
          {filtered.map((e) => (
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

/** The full progression ladder of one exercise, easiest first. */
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
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto pb-8">
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

        <div className="space-y-3 px-4">
          {exercise.imageUrl && (
            <div className="flex justify-center overflow-hidden rounded-lg border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={exercise.imageUrl}
                alt={exercise.title}
                loading="lazy"
                decoding="async"
                className="max-h-56 w-full object-contain"
              />
            </div>
          )}

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
              {p.imageUrl && (
                <div className="flex justify-center overflow-hidden rounded-lg border bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.imageUrl}
                    alt={`${exercise.title} — ${p.name}`}
                    loading="lazy"
                    decoding="async"
                    className="max-h-56 w-full object-contain"
                  />
                </div>
              )}
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
      </SheetContent>
    </Sheet>
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
