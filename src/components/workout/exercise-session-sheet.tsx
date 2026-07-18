"use client";

import { useState } from "react";
import { Check, ChevronDown, SlidersHorizontal, Trophy } from "lucide-react";
import {
  INTER_TECHNIQUES,
  MEASUREMENT_LABELS,
  MEASUREMENT_UNIT,
  TECHNIQUES_BY_ID,
} from "@/lib/domain/types";
import {
  Exercise,
  measurementOf,
  VolumeStats,
  WorkoutExercise,
} from "@/lib/domain/schemas";
import { statsKey } from "@/lib/domain/volume";
import {
  Sheet,
  SheetContent,
  SheetDescription,
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ExpandableText } from "@/components/ui/expandable-text";
import { cn } from "@/lib/utils";

const NONE = "none";

/**
 * The embeddable player URL for a YouTube link (watch, share, shorts or
 * embed form), or null for anything else. Playing inline (`playsinline`)
 * keeps the video inside the app; the player's own button goes fullscreen.
 */
function youtubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    let id: string | null = null;
    if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
    else if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
      if (u.pathname === "/watch") id = u.searchParams.get("v");
      else if (u.pathname.startsWith("/shorts/") || u.pathname.startsWith("/embed/") || u.pathname.startsWith("/live/")) {
        id = u.pathname.split("/")[2] ?? null;
      }
    }
    if (!id || !/^[\w-]{6,}$/.test(id)) return null;
    return `https://www.youtube-nocookie.com/embed/${id}?playsinline=1&rel=0`;
  } catch {
    return null;
  }
}

/**
 * Mid-workout exercise sheet: read the progression descriptions, swap the
 * progression for this session, and set the inter-exercise technique + notes.
 * Changes affect only this session's log, never the program plan.
 */
export function ExerciseSessionSheet({
  open,
  onOpenChange,
  exercise,
  planned,
  progressionId,
  interTechniqueId,
  notes,
  stats,
  readOnly,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exercise: Exercise;
  planned: WorkoutExercise;
  progressionId: string;
  interTechniqueId?: string;
  notes?: string;
  stats: Record<string, VolumeStats>;
  readOnly: boolean;
  onChange: (patch: {
    progressionId?: string;
    interTechniqueId?: string | null;
    notes?: string;
  }) => void;
}) {
  const technique = interTechniqueId
    ? TECHNIQUES_BY_ID.get(interTechniqueId)
    : undefined;
  // Progression swapping and technique live behind this toggle so the sheet
  // opens on what most athletes need: the current plan, tutorial and notes.
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Tutorial media follows the progression being trained right now.
  const progression = exercise.progressions.find((p) => p.id === progressionId);
  const embedUrl = progression?.videoUrl
    ? youtubeEmbedUrl(progression.videoUrl)
    : null;
  const tutorialImage = progression?.imageUrl || exercise.imageUrl;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto pb-8">
        <SheetHeader>
          <SheetTitle>{exercise.title}</SheetTitle>
          <SheetDescription>
            {
              MEASUREMENT_LABELS[
                measurementOf(exercise, progressionId, planned.measurement)
              ]
            }
            {exercise.repStyle === "cluster" && " · cluster reps (eccentric)"}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-4">
          {/* What you're doing right now — progression, plan and description
              stay visible without opening anything. */}
          <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <p className="text-sm">
              <span className="font-semibold text-sky-600 dark:text-sky-400">
                {progression?.name}
              </span>
              {progression && progression.id !== planned.progressionId && (
                <span className="text-muted-foreground"> (swapped)</span>
              )}
            </p>
            <p className="text-sm text-muted-foreground">
              {planned.tempo && (
                <>
                  Tempo{" "}
                  <span className="font-medium text-foreground">
                    {planned.tempo}
                  </span>{" "}
                  ·{" "}
                </>
              )}
              Rest{" "}
              <span className="font-medium text-foreground">
                {planned.restSeconds}s
              </span>
              {exercise.repStyle === "cluster" && (
                <>
                  {" "}
                  · {planned.clusterRestSeconds ?? 15}s between cluster reps
                </>
              )}
            </p>
            {progression?.description && (
              <ExpandableText
                text={progression.description}
                className="text-sm"
              />
            )}
          </div>

          {(embedUrl || tutorialImage) && (
            <div className="space-y-2">
              <Label>Tutorial</Label>
              {embedUrl && (
                <iframe
                  key={embedUrl}
                  src={embedUrl}
                  title={`${exercise.title} — ${progression?.name ?? "tutorial"} video`}
                  className="aspect-video w-full rounded-lg border bg-muted"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              )}
              {tutorialImage && (
                <div className="flex justify-center overflow-hidden rounded-lg border bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={tutorialImage}
                    alt={exercise.title}
                    className="max-h-64 w-full object-contain"
                  />
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            aria-expanded={advancedOpen}
            onClick={() => setAdvancedOpen((o) => !o)}
            className="flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors hover:border-foreground/30"
          >
            <span className="flex items-center gap-2">
              <SlidersHorizontal className="size-4 text-muted-foreground" />
              Advanced settings
            </span>
            <ChevronDown
              className={cn(
                "size-4 text-muted-foreground transition-transform",
                advancedOpen && "rotate-180",
              )}
            />
          </button>

          {advancedOpen && (
          <>
          <div className="space-y-2">
            <Label>Progression — tap to use a different one today</Label>
            <div className="space-y-2">
              {exercise.progressions.map((p) => {
                const s = stats[statsKey(exercise.id, p.id)];
                const active = p.id === progressionId;
                const isPlan = p.id === planned.progressionId;
                const bestMeasure = measurementOf(exercise, p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={readOnly}
                    onClick={() => onChange({ progressionId: p.id })}
                    className={cn(
                      "w-full rounded-lg border p-3 text-left transition-colors",
                      active
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "hover:border-foreground/30",
                      readOnly && "opacity-60",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{p.name}</span>
                      {isPlan && (
                        <Badge variant="outline" className="text-[10px]">
                          plan
                        </Badge>
                      )}
                      {active && <Check className="ml-auto size-4 text-primary" />}
                    </div>
                    {p.description && (
                      <ExpandableText text={p.description} className="mt-1" />
                    )}
                    {s?.maxReps != null && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <Trophy className="size-3" /> best: {s.maxReps}
                        {bestMeasure === "reps"
                          ? " reps"
                          : MEASUREMENT_UNIT[bestMeasure]}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Inter-exercise progression technique</Label>
            <Select
              value={interTechniqueId ?? NONE}
              onValueChange={(v) =>
                onChange({ interTechniqueId: v === NONE ? null : v })
              }
              disabled={readOnly}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                {INTER_TECHNIQUES.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {technique && (
              <p className="text-xs text-muted-foreground">
                {technique.description}
              </p>
            )}
            {technique?.kind === "hybrid" && (
              <p className="text-xs font-medium text-primary">
                Each set can mix progressions: log reps per progression inside
                the set on the workout screen (e.g. 1 full + 5 knee push-ups).
              </p>
            )}
            {technique?.kind === "hybrid_eccentric" && (
              <p className="text-xs font-medium text-primary">
                Each set on the workout screen gets two fields: dynamic reps +
                eccentric reps.
              </p>
            )}
          </div>
          </>
          )}

          <div className="space-y-2">
            <Label htmlFor="session-notes">
              {technique?.kind === "notes" ? `${technique.name} notes` : "Notes"}
            </Label>
            <Textarea
              id="session-notes"
              placeholder={
                technique?.prompt ??
                "How did it feel? Track your inter-exercise progression here…"
              }
              disabled={readOnly}
              value={notes ?? ""}
              onChange={(e) => onChange({ notes: e.target.value })}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
