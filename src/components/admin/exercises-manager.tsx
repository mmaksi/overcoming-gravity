"use client";

import { useMemo, useState, useTransition } from "react";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Minus,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import {
  Attribute,
  ATTRIBUTE_LABELS,
  ATTRIBUTES,
  CATEGORIES,
  Category,
  CATEGORY_LABELS,
  Measurement,
  MEASUREMENT_LABELS,
  MEASUREMENTS,
  RepStyle,
} from "@/lib/domain/types";
import { Exercise } from "@/lib/domain/schemas";
import { removeExercise, saveExercise } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Draft = {
  id: string;
  title: string;
  category: Category;
  attribute: Attribute;
  measurement: Measurement;
  repStyle: RepStyle;
  progressions: { id: string; name: string; order: number; description: string }[];
};

/** Capitalize the first letter of every word as the admin types. */
function titleCase(value: string): string {
  return value.replace(/(^|\s)(\S)/g, (_, sep, ch) => sep + ch.toUpperCase());
}

export function ExercisesManager({ exercises }: { exercises: Exercise[] }) {
  const [query, setQuery] = useState("");
  const [attribute, setAttribute] = useState<Attribute | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      exercises.filter((e) => {
        if (attribute && e.attribute !== attribute) return false;
        return e.title.toLowerCase().includes(query.toLowerCase());
      }),
    [exercises, query, attribute],
  );

  const isEdit = exercises.some((e) => e.id === draft?.id);

  // Exercise titles are unique (case-insensitive). Surface the clash while
  // typing, before the admin ever reaches the Save button.
  const draftTitle = draft?.title.trim().toLowerCase() ?? "";
  const duplicate =
    draftTitle.length > 0 &&
    exercises.some(
      (e) => e.id !== draft?.id && e.title.trim().toLowerCase() === draftTitle,
    );
  const titleMatches =
    draft && draftTitle.length >= 2
      ? exercises
          .filter(
            (e) =>
              e.id !== draft.id &&
              e.title.toLowerCase().includes(draftTitle),
          )
          .slice(0, 3)
      : [];

  const valid =
    draft &&
    draft.title.trim() &&
    !duplicate &&
    draft.progressions.length > 0 &&
    draft.progressions.every((p) => p.name.trim());

  const [focusProgressionId, setFocusProgressionId] = useState<string | null>(
    null,
  );

  function moveProgression(index: number, delta: -1 | 1) {
    if (!draft) return;
    const target = index + delta;
    if (target < 0 || target >= draft.progressions.length) return;
    const next = [...draft.progressions];
    [next[index], next[target]] = [next[target], next[index]];
    setDraft({ ...draft, progressions: next });
  }

  function submit() {
    if (!draft) return;
    setError(null);
    startTransition(async () => {
      try {
        await saveExercise({
          ...draft,
          progressions: draft.progressions.map((p, i) => ({ ...p, order: i })),
        });
        setDraft(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save");
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          placeholder="Search exercises…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button
          size="sm"
          className="shrink-0"
          onClick={() =>
            setDraft({
              id: crypto.randomUUID(),
              title: "",
              category: "push",
              attribute: "strength",
              measurement: "reps",
              repStyle: "standard",
              progressions: [
                { id: crypto.randomUUID(), name: "", order: 0, description: "" },
              ],
            })
          }
        >
          <Plus className="size-4" /> Add
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {ATTRIBUTES.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setAttribute(attribute === a ? null : a)}
            className={
              attribute === a
                ? "rounded-full border border-primary bg-primary px-3 py-1.5 text-sm text-primary-foreground"
                : "rounded-full border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-foreground/30"
            }
          >
            {ATTRIBUTE_LABELS[a]}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="space-y-2">
        {filtered.map((e) => (
          <div
            key={e.id}
            className="flex items-center justify-between rounded-lg border p-3"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium">{e.title}</span>
                <Badge variant="outline" className="text-[10px]">
                  {CATEGORY_LABELS[e.category]}
                </Badge>
                <Badge variant="secondary" className="text-[10px]">
                  {ATTRIBUTE_LABELS[e.attribute]}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {e.progressions.map((p) => p.name).join(" → ")}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  setDraft({
                    id: e.id,
                    title: e.title,
                    category: e.category,
                    attribute: e.attribute,
                    measurement: e.measurement ?? "reps",
                    repStyle: e.repStyle ?? "standard",
                    progressions: e.progressions.map((p) => ({
                      ...p,
                      description: p.description ?? "",
                    })),
                  })
                }
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    setError(null);
                    try {
                      await removeExercise(e.id);
                    } catch (err) {
                      setError(
                        err instanceof Error ? err.message : "Failed to delete",
                      );
                    }
                  })
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Sheet open={draft !== null} onOpenChange={(o) => !o && setDraft(null)}>
        <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto pb-8">
          <SheetHeader>
            <SheetTitle>{isEdit ? "Edit exercise" : "New exercise"}</SheetTitle>
          </SheetHeader>
          {draft && (
            <div className="space-y-4 px-4">
              <div className="space-y-2">
                <Label htmlFor="ex-title">Title</Label>
                <Input
                  id="ex-title"
                  aria-invalid={duplicate || undefined}
                  value={draft.title}
                  onChange={(e) =>
                    setDraft({ ...draft, title: titleCase(e.target.value) })
                  }
                />
                {duplicate && (
                  <p className="text-sm font-medium text-destructive">
                    An exercise with this title already exists.
                  </p>
                )}
                {!duplicate && titleMatches.length > 0 && (
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>Similar existing exercises:</p>
                    {titleMatches.map((e) => (
                      <p key={e.id} className="pl-2">
                        · {e.title}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={draft.category}
                    onValueChange={(v) =>
                      setDraft({ ...draft, category: v as Category })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {CATEGORY_LABELS[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Attribute</Label>
                  <Select
                    value={draft.attribute}
                    onValueChange={(v) =>
                      setDraft({ ...draft, attribute: v as Attribute })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ATTRIBUTES.map((a) => (
                        <SelectItem key={a} value={a}>
                          {ATTRIBUTE_LABELS[a]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Measured by</Label>
                <Select
                  value={draft.measurement}
                  onValueChange={(v) =>
                    setDraft({ ...draft, measurement: v as Measurement })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEASUREMENTS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {MEASUREMENT_LABELS[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Progressions (easiest → hardest)</Label>
                {draft.progressions.map((p, i) => (
                  <div key={p.id} className="space-y-2 rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                      <span className="w-5 text-xs text-muted-foreground">
                        {i + 1}.
                      </span>
                      <Input
                        value={p.name}
                        placeholder="e.g. Tuck"
                        autoFocus={p.id === focusProgressionId}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            progressions: draft.progressions.map((x, j) =>
                              j === i
                                ? { ...x, name: titleCase(e.target.value) }
                                : x,
                            ),
                          })
                        }
                      />
                      <div className="flex flex-col">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label="Move progression up"
                          disabled={i === 0}
                          onClick={() => moveProgression(i, -1)}
                        >
                          <ChevronUp className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label="Move progression down"
                          disabled={i === draft.progressions.length - 1}
                          onClick={() => moveProgression(i, 1)}
                        >
                          <ChevronDown className="size-4" />
                        </Button>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={draft.progressions.length <= 1}
                        onClick={() =>
                          setDraft({
                            ...draft,
                            progressions: draft.progressions.filter(
                              (_, j) => j !== i,
                            ),
                          })
                        }
                      >
                        <Minus className="size-4" />
                      </Button>
                    </div>
                    <Textarea
                      value={p.description}
                      placeholder="Describe this progression: setup, cues, when to move on…"
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          progressions: draft.progressions.map((x, j) =>
                            j === i
                              ? { ...x, description: e.target.value }
                              : x,
                          ),
                        })
                      }
                    />
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const id = crypto.randomUUID();
                    setFocusProgressionId(id);
                    setDraft({
                      ...draft,
                      progressions: [
                        ...draft.progressions,
                        {
                          id,
                          name: "",
                          order: draft.progressions.length,
                          description: "",
                        },
                      ],
                    });
                  }}
                >
                  <Plus className="size-4" /> Add progression
                </Button>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button className="w-full" disabled={!valid || pending} onClick={submit}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
