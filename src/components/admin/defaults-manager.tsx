"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Minus, Plus } from "lucide-react";
import { ATTRIBUTE_LABELS } from "@/lib/domain/types";
import { DefaultTemplate, Exercise, TemplateEntry } from "@/lib/domain/schemas";
import { saveTemplate } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function DefaultsManager({
  template,
  exercises,
}: {
  template: DefaultTemplate;
  exercises: Exercise[];
}) {
  const [entries, setEntries] = useState<TemplateEntry[]>(template.entries);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const byId = new Map(exercises.map((e) => [e.id, e]));

  function update(i: number, patch: Partial<TemplateEntry>) {
    setSaved(false);
    setEntries((prev) =>
      prev.map((e, j) => (j === i ? { ...e, ...patch } : e)),
    );
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        await saveTemplate({ id: "default", entries });
        setSaved(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save");
      }
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Recommended default exercises every new workout day starts with
        (warm-up, prehab, isolation, flexibility, cool-down…). Athletes can
        modify them freely. Skill work is added from the athlete&apos;s chosen
        skills.
      </p>

      {entries.map((entry, i) => {
        const exercise = byId.get(entry.exerciseId);
        return (
          <div key={i} className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <Select
                value={entry.exerciseId}
                onValueChange={(exerciseId) => {
                  const ex = byId.get(exerciseId);
                  update(i, {
                    exerciseId,
                    progressionId: ex?.progressions[0].id ?? "",
                  });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {exercises.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {exercise && (
                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  {ATTRIBUTE_LABELS[exercise.attribute]}
                </Badge>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 text-destructive"
                onClick={() => {
                  setSaved(false);
                  setEntries((prev) => prev.filter((_, j) => j !== i));
                }}
              >
                <Minus className="size-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={entry.progressionId}
                onValueChange={(progressionId) => update(i, { progressionId })}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Progression" />
                </SelectTrigger>
                <SelectContent>
                  {exercise?.progressions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                className="w-28"
                value={entry.sets.map((s) => s.reps).join(",")}
                placeholder="reps: 10,8,8"
                onChange={(e) => {
                  const sets = e.target.value
                    .split(",")
                    .map((x) => parseInt(x.trim(), 10))
                    .filter((n) => Number.isFinite(n) && n > 0)
                    .map((reps) => ({ reps }));
                  if (sets.length > 0) update(i, { sets });
                }}
              />
              <Input
                className="w-20"
                type="number"
                min={0}
                value={entry.restSeconds}
                onChange={(e) =>
                  update(i, {
                    restSeconds: Math.max(0, Number(e.target.value) || 0),
                  })
                }
              />
              <span className="text-xs text-muted-foreground">s rest</span>
            </div>
          </div>
        );
      })}

      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          const first = exercises[0];
          if (!first) return;
          setSaved(false);
          setEntries((prev) => [
            ...prev,
            {
              exerciseId: first.id,
              progressionId: first.progressions[0].id,
              sets: [{ reps: 10 }],
              restSeconds: 60,
            },
          ]);
        }}
      >
        <Plus className="size-4" /> Add entry
      </Button>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button className="w-full" disabled={pending} onClick={submit}>
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : saved ? (
          <>
            <Check className="size-4" /> Saved
          </>
        ) : (
          "Save defaults"
        )}
      </Button>
    </div>
  );
}
