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
import { Exercise } from "@/lib/domain/schemas";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function ExercisePicker({
  open,
  onOpenChange,
  exercises,
  section = null,
  onPick,
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
  onPick: (exercise: Exercise) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | null>(null);
  const [attribute, setAttribute] = useState<Attribute | null>(section);

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
              Pick any exercise from the library
              {section
                ? ` — it goes into the ${ATTRIBUTE_LABELS[section].toLowerCase()} section.`
                : "."}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-2.5 px-4 pb-3">
            <Input
              placeholder="Search…"
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
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
            {filtered.length === 0 && (
              <p className="py-8 text-center text-muted-foreground">
                No exercises match.
              </p>
            )}
            <div className="space-y-2">
              {filtered.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => onPick(e)}
                  className="w-full rounded-xl bg-muted/50 p-4 text-left transition-colors hover:bg-muted"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{e.title}</span>
                    <span className="flex gap-1">
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
                </button>
              ))}
            </div>
          </div>
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
