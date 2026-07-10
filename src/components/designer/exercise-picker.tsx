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
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exercises: Exercise[];
  onPick: (exercise: Exercise) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | null>(null);
  const [attribute, setAttribute] = useState<Attribute | null>(null);

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
      <SheetContent side="bottom" className="h-[85dvh] overflow-hidden p-0">
        <div className="flex h-full flex-col">
          <SheetHeader className="pb-2">
            <SheetTitle>Add exercise</SheetTitle>
            <SheetDescription>
              Pick from the exercise library.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-2 px-4 pb-2">
            <Input
              placeholder="Search…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="flex flex-wrap gap-1">
              {CATEGORIES.map((c) => (
                <FilterChip
                  key={c}
                  label={CATEGORY_LABELS[c]}
                  active={category === c}
                  onClick={() => setCategory(category === c ? null : c)}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
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

          <div className="flex-1 overflow-y-auto px-4 pb-6">
            {filtered.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No exercises match.
              </p>
            )}
            <div className="space-y-2">
              {filtered.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => onPick(e)}
                  className="w-full rounded-lg border p-3 text-left transition-colors hover:border-foreground/30"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{e.title}</span>
                    <span className="flex gap-1">
                      <Badge variant="outline">
                        {CATEGORY_LABELS[e.category]}
                      </Badge>
                      <Badge variant="secondary">
                        {ATTRIBUTE_LABELS[e.attribute]}
                      </Badge>
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
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
        "rounded-full border px-2.5 py-1 text-xs transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "text-muted-foreground hover:border-foreground/30",
      )}
    >
      {label}
    </button>
  );
}
