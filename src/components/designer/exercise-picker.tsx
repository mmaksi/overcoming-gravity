"use client";

import { useMemo, useState } from "react";
import {
  Attribute,
  ATTRIBUTE_LABELS,
  ATTRIBUTES,
  CATEGORIES,
  Category,
  CATEGORY_LABELS,
} from "@/lib/domain/types";
import {
  DEFAULT_SPORT,
  Exercise,
  exerciseSport,
} from "@/lib/domain/schemas";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExerciseThumb } from "@/components/exercise/exercise-thumb";
import { FilterChip } from "@/components/ui/filter-chip";
import { cn } from "@/lib/utils";

export function ExercisePicker({
  open,
  onOpenChange,
  exercises,
  section = null,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exercises: Exercise[];
  /**
   * The day section being added to. Any exercise can go into any section —
   * this only preselects the attribute filter (clearable) and names the
   * sheet. Remount with `key={section}` so the filter resets per section.
   */
  section?: Attribute | null;
  /**
   * Add the chosen exercises to the day. Tapping rows toggles a multi-select;
   * the footer button commits them all at once (in the order they were
   * picked). Remount with `key={section}` so the selection resets per open.
   */
  onAdd: (exercises: Exercise[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | null>(null);
  const [attribute, setAttribute] = useState<Attribute | null>(section);
  const [sport, setSport] = useState<string | null>(null);
  // Ids of picked exercises, kept in tap order so they're added in the order
  // the user chose them (not library order).
  const [picked, setPicked] = useState<string[]>([]);

  function togglePicked(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  function commit() {
    if (picked.length === 0) return;
    const byId = new Map(exercises.map((e) => [e.id, e]));
    onAdd(picked.map((id) => byId.get(id)!).filter(Boolean));
  }

  // Sport chips appear only once the library actually spans several sports
  // (calisthenics first).
  const sports = useMemo(() => {
    const others = [
      ...new Set(exercises.map(exerciseSport)),
    ].filter((s) => s !== DEFAULT_SPORT);
    return others.length > 0 ? [DEFAULT_SPORT, ...others.sort()] : [];
  }, [exercises]);

  const filtered = useMemo(
    () =>
      exercises.filter((e) => {
        if (category && e.category !== category) return false;
        if (attribute && e.attribute !== attribute) return false;
        if (sport && exerciseSport(e) !== sport) return false;
        if (query && !e.title.toLowerCase().includes(query.toLowerCase()))
          return false;
        return true;
      }),
    [exercises, category, attribute, sport, query],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* The base sheet sets data-[side=bottom]:h-auto, which would make the
          sheet grow/shrink with the result list. Override at the SAME
          variant so tailwind-merge drops h-auto and the height stays fixed
          no matter how many exercises match. */}
      <SheetContent
        side="bottom"
        className="data-[side=bottom]:h-[85dvh] max-h-[85dvh] overflow-hidden p-0"
      >
        <div className="flex h-full min-h-0 flex-col">
          <SheetHeader className="pb-2">
            <SheetTitle>
              {section
                ? `Add to ${ATTRIBUTE_LABELS[section].toLowerCase()}`
                : "Add exercise"}
            </SheetTitle>
            <SheetDescription>
              Pick one or more exercises from the library
              {section
                ? ` — they go into the ${ATTRIBUTE_LABELS[section].toLowerCase()} section.`
                : "."}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-2.5 px-4 pb-3">
            <Input
              placeholder="Search…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {sports.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {sports.map((s) => (
                  <FilterChip
                    key={s}
                    label={s}
                    active={sport === s}
                    onClick={() => setSport(sport === s ? null : s)}
                  />
                ))}
              </div>
            )}
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
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
            {filtered.length === 0 && (
              <p className="py-8 text-center text-muted-foreground">
                No exercises match.
              </p>
            )}
            <div className="space-y-2">
              {filtered.map((e) => {
                const isPicked = picked.includes(e.id);
                return (
                <button
                  key={e.id}
                  type="button"
                  aria-pressed={isPicked}
                  onClick={() => togglePicked(e.id)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-xl bg-muted/50 p-4 text-left transition-colors hover:bg-muted",
                    isPicked && "bg-primary/10 ring-2 ring-primary hover:bg-primary/10",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-sm",
                      isPicked
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/40",
                    )}
                  >
                    {isPicked && "✓"}
                  </span>
                  <ExerciseThumb title={e.title} imageUrl={e.imageUrl} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{e.title}</span>
                      <span className="flex gap-1">
                        {sport === null &&
                          exerciseSport(e) !== DEFAULT_SPORT && (
                            <Badge>{exerciseSport(e)}</Badge>
                          )}
                        <Badge variant="outline">
                          {CATEGORY_LABELS[e.category]}
                        </Badge>
                        {attribute === null && (
                          <Badge variant="secondary">
                            {ATTRIBUTE_LABELS[e.attribute]}
                          </Badge>
                        )}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {e.progressions.map((p) => p.name).join(" → ")}
                    </p>
                  </div>
                </button>
                );
              })}
            </div>
          </div>

          {/* Commit bar: adds every picked exercise at once. Hidden until at
              least one is selected so single-tap picking stays uncluttered. */}
          {picked.length > 0 && (
            <div className="border-t bg-background px-4 py-3">
              <Button className="w-full" size="lg" onClick={commit}>
                {`Add ${picked.length} exercise${picked.length === 1 ? "" : "s"}`}
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

