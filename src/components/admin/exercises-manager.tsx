"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
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
  MEASUREMENT_SHORT,
  MEASUREMENTS,
  RepStyle,
} from "@/lib/domain/types";
import {
  DEFAULT_SPORT,
  Exercise,
  exerciseSport,
  measurementOf,
} from "@/lib/domain/schemas";
import { removeExercise, saveExercise } from "@/lib/actions/admin";
import { ExerciseThumb } from "@/components/exercise/exercise-thumb";
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

type DraftProgression = {
  id: string;
  name: string;
  order: number;
  description: string;
  measurement: Measurement;
  /** Optional YouTube tutorial embedded in the workout logger's info sheet. */
  videoUrl: string;
  /** Optional illustration; falls back to the exercise image in the app. */
  imageUrl: string;
};

type Draft = {
  id: string;
  title: string;
  category: Category;
  attribute: Attribute;
  measurement: Measurement;
  repStyle: RepStyle;
  /** Free-form sport name ("Calisthenics", "Parkour", …). */
  sport: string;
  imageUrl: string;
  progressions: DraftProgression[];
};

/** Capitalize the first letter of every word as the admin types. */
function titleCase(value: string): string {
  return value.replace(/(^|\s)(\S)/g, (_, sep, ch) => sep + ch.toUpperCase());
}

export function ExercisesManager({ exercises }: { exercises: Exercise[] }) {
  const [query, setQuery] = useState("");
  const [attribute, setAttribute] = useState<Attribute | null>(null);
  const [sport, setSport] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Every sport in the library (calisthenics first) — filter chips plus
  // suggestions for the draft's sport input.
  const sports = useMemo(() => {
    const others = [
      ...new Set(exercises.map(exerciseSport)),
    ].filter((s) => s !== DEFAULT_SPORT);
    return [DEFAULT_SPORT, ...others.sort()];
  }, [exercises]);

  const saveMutation = useMutation({
    mutationFn: (d: Draft) =>
      saveExercise({
        ...d,
        sport: d.sport.trim() || DEFAULT_SPORT,
        // Keep the exercise-level default aligned with the first progression,
        // so any legacy reader without a progression still gets a sane unit.
        measurement: d.progressions[0]?.measurement ?? d.measurement,
        progressions: d.progressions.map((p, i) => ({ ...p, order: i })),
      }),
    onSuccess: () => setDraft(null),
    onError: (e) => setError(e instanceof Error ? e.message : "Failed to save"),
  });
  const removeMutation = useMutation({
    mutationFn: (id: string) => removeExercise(id),
    onError: (e) =>
      setError(e instanceof Error ? e.message : "Failed to delete"),
  });
  const pending = saveMutation.isPending || removeMutation.isPending;

  const filtered = useMemo(
    () =>
      exercises.filter((e) => {
        if (attribute && e.attribute !== attribute) return false;
        if (sport && exerciseSport(e) !== sport) return false;
        return e.title.toLowerCase().includes(query.toLowerCase());
      }),
    [exercises, query, attribute, sport],
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
    saveMutation.mutate(draft);
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
              // New exercises inherit the active sport filter (adding a
              // batch of parkour moves shouldn't need retyping the sport).
              sport: sport ?? DEFAULT_SPORT,
              imageUrl: "",
              progressions: [
                {
                  id: crypto.randomUUID(),
                  name: "",
                  order: 0,
                  description: "",
                  measurement: "reps",
                  videoUrl: "",
                  imageUrl: "",
                },
              ],
            })
          }
        >
          <Plus className="size-4" /> Add
        </Button>
      </div>

      {sports.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {sports.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSport(sport === s ? null : s)}
              className={
                sport === s
                  ? "rounded-full border border-primary bg-primary px-3 py-1.5 text-sm text-primary-foreground"
                  : "rounded-full border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-foreground/30"
              }
            >
              {s}
            </button>
          ))}
        </div>
      )}

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
            <div className="flex min-w-0 items-center gap-3">
              <ExerciseThumb title={e.title} imageUrl={e.imageUrl} />
              <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium">{e.title}</span>
                <Badge variant="outline" className="text-[10px]">
                  {CATEGORY_LABELS[e.category]}
                </Badge>
                <Badge variant="secondary" className="text-[10px]">
                  {ATTRIBUTE_LABELS[e.attribute]}
                </Badge>
                {exerciseSport(e) !== DEFAULT_SPORT && (
                  <Badge className="text-[10px]">{exerciseSport(e)}</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {e.progressions.map((p) => p.name).join(" → ")}
              </p>
              </div>
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
                    measurement: measurementOf(e, e.progressions[0]?.id),
                    repStyle: e.repStyle ?? "standard",
                    sport: exerciseSport(e),
                    imageUrl: e.imageUrl ?? "",
                    progressions: e.progressions.map((p) => ({
                      ...p,
                      description: p.description ?? "",
                      // Resolve (and normalize legacy "time") the per-progression
                      // unit, falling back to the exercise-level default.
                      measurement: measurementOf(e, p.id),
                      videoUrl: p.videoUrl ?? "",
                      imageUrl: p.imageUrl ?? "",
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
                onClick={() => {
                  setError(null);
                  removeMutation.mutate(e.id);
                }}
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

              <div className="space-y-2">
                <Label htmlFor="ex-image">Image URL (optional)</Label>
                <div className="flex items-center gap-3">
                  <ExerciseThumb
                    title={draft.title || "?"}
                    imageUrl={draft.imageUrl}
                  />
                  <Input
                    id="ex-image"
                    type="url"
                    inputMode="url"
                    placeholder="https://…"
                    value={draft.imageUrl}
                    onChange={(e) =>
                      setDraft({ ...draft, imageUrl: e.target.value })
                    }
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Shown in the exercise picker. Leave blank to use the first
                  letter of the title.
                </p>
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
                <Label htmlFor="ex-sport">Sport</Label>
                <Input
                  id="ex-sport"
                  list="ex-sport-options"
                  placeholder={DEFAULT_SPORT}
                  value={draft.sport}
                  onChange={(e) =>
                    setDraft({ ...draft, sport: titleCase(e.target.value) })
                  }
                />
                <datalist id="ex-sport-options">
                  {sports.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
                <p className="text-xs text-muted-foreground">
                  Pick an existing sport or type a new one (e.g. Parkour) —
                  athletes can filter the library by it.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Progressions (easiest → hardest)</Label>
                <p className="text-xs text-muted-foreground">
                  Each progression sets its own &ldquo;measured by&rdquo; unit —
                  some are reps, some are seconds of hold.
                </p>
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
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        Measured by
                      </span>
                      <div className="flex gap-1">
                        {MEASUREMENTS.map((m) => (
                          <button
                            key={m}
                            type="button"
                            aria-pressed={p.measurement === m}
                            onClick={() =>
                              setDraft({
                                ...draft,
                                progressions: draft.progressions.map((x, j) =>
                                  j === i ? { ...x, measurement: m } : x,
                                ),
                              })
                            }
                            className={
                              p.measurement === m
                                ? "rounded-md border border-primary bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground"
                                : "rounded-md border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/30"
                            }
                          >
                            {MEASUREMENT_SHORT[m]}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Input
                      type="url"
                      inputMode="url"
                      placeholder="YouTube tutorial URL (optional)"
                      aria-label="Tutorial video URL"
                      value={p.videoUrl}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          progressions: draft.progressions.map((x, j) =>
                            j === i ? { ...x, videoUrl: e.target.value } : x,
                          ),
                        })
                      }
                    />
                    <Input
                      type="url"
                      inputMode="url"
                      placeholder="Image URL (optional, falls back to the exercise image)"
                      aria-label="Progression image URL"
                      value={p.imageUrl}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          progressions: draft.progressions.map((x, j) =>
                            j === i ? { ...x, imageUrl: e.target.value } : x,
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
                          // Inherit the previous progression's unit as a sane
                          // default; the admin can flip it per progression.
                          measurement:
                            draft.progressions.at(-1)?.measurement ?? "reps",
                          videoUrl: "",
                          imageUrl: "",
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
