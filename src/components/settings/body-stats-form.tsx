"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Check, CloudUpload, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { BodyweightEntry } from "@/lib/domain/schemas";
import { deleteBodyweight, saveBodyweight } from "@/lib/actions/bodyweight";
import { saveBodyStats } from "@/lib/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SaveState = "idle" | "dirty" | "saving" | "saved";

/**
 * Body measurements, all editable in Settings. Height and target weight (the
 * BMI inputs) **autosave** ~800ms after you stop typing — no Save button. The
 * bodyweight log stays an explicit add (a discrete dated data point, not a
 * field edit): typing a weight and pressing Log upserts that day's entry.
 */
export function BodyStatsForm({
  initialHeightCm,
  initialTargetWeightKg,
  entries,
  today,
}: {
  initialHeightCm?: number;
  initialTargetWeightKg?: number;
  entries: BodyweightEntry[];
  today: string;
}) {
  const [height, setHeight] = useState(
    initialHeightCm != null ? String(initialHeightCm) : "",
  );
  const [target, setTarget] = useState(
    initialTargetWeightKg != null ? String(initialTargetWeightKg) : "",
  );
  const [statsState, setStatsState] = useState<SaveState>("idle");
  const statsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestStats = useRef({
    height: initialHeightCm != null ? String(initialHeightCm) : "",
    target: initialTargetWeightKg != null ? String(initialTargetWeightKg) : "",
  });

  const [date, setDate] = useState(today);
  const [weight, setWeight] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Height + target autosave together. Both refresh the home Stats block
  // server-side (userStatsTag); there is no client-cached read to invalidate.
  const statsMutation = useMutation({
    mutationFn: () =>
      saveBodyStats({
        heightCm:
          latestStats.current.height.trim() === ""
            ? null
            : Number(latestStats.current.height),
        targetWeightKg:
          latestStats.current.target.trim() === ""
            ? null
            : Number(latestStats.current.target),
      }),
    onMutate: () => setStatsState("saving"),
    onSuccess: () => setStatsState("saved"),
    onError: (e) => {
      setStatsState("dirty");
      setError(e instanceof Error ? e.message : "Couldn't save");
    },
  });

  useEffect(
    () => () => {
      if (statsTimer.current) clearTimeout(statsTimer.current);
    },
    [],
  );

  function scheduleStatsSave() {
    setError(null);
    setStatsState("dirty");
    if (statsTimer.current) clearTimeout(statsTimer.current);
    statsTimer.current = setTimeout(() => {
      const h = latestStats.current.height.trim();
      const t = latestStats.current.target.trim();
      // Wait for valid input (empty clears it; otherwise a positive number).
      if ((h !== "" && !(Number(h) > 0)) || (t !== "" && !(Number(t) > 0))) {
        setStatsState("dirty");
        return;
      }
      statsMutation.mutate();
    }, 800);
  }

  function onHeightChange(v: string) {
    setHeight(v);
    latestStats.current = { ...latestStats.current, height: v };
    scheduleStatsSave();
  }
  function onTargetChange(v: string) {
    setTarget(v);
    latestStats.current = { ...latestStats.current, target: v };
    scheduleStatsSave();
  }

  const logMutation = useMutation({
    mutationFn: (weightKg: number) => saveBodyweight({ date, weightKg }),
    onSuccess: () => setWeight(""),
    onError: (e) => setError(e instanceof Error ? e.message : "Couldn't save"),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBodyweight(id),
  });
  const logPending = logMutation.isPending || deleteMutation.isPending;

  function logWeight() {
    const weightKg = Number(weight);
    if (!weightKg || weightKg <= 0 || !date) return;
    setError(null);
    logMutation.mutate(weightKg);
  }

  // Newest first; keep the list short — the chart on Home shows the trend.
  const recent = [...entries].reverse().slice(0, 8);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Height & target weight</Label>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {statsState === "saving" && (
              <>
                <Loader2 className="size-3 animate-spin" /> Saving…
              </>
            )}
            {statsState === "dirty" && (
              <>
                <CloudUpload className="size-3" /> Unsaved…
              </>
            )}
            {statsState === "saved" && (
              <>
                <Check className="size-3 text-primary" /> Saved
              </>
            )}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="height-cm" className="text-xs text-muted-foreground">
              Height (cm)
            </Label>
            <Input
              id="height-cm"
              type="number"
              inputMode="decimal"
              min={0}
              placeholder="175"
              value={height}
              onChange={(e) => onHeightChange(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label
              htmlFor="target-weight"
              className="text-xs text-muted-foreground"
            >
              Target weight (kg)
            </Label>
            <Input
              id="target-weight"
              type="number"
              inputMode="decimal"
              step={0.1}
              min={0}
              placeholder="72.0"
              value={target}
              onChange={(e) => onTargetChange(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="weigh-in">Log a weigh-in</Label>
        <div className="flex gap-2">
          <Input
            type="date"
            aria-label="Weigh-in date"
            className="w-36 shrink-0"
            max={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <Input
            id="weigh-in"
            type="number"
            inputMode="decimal"
            step={0.1}
            min={0}
            placeholder="kg"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && logWeight()}
          />
          <Button
            className="shrink-0"
            disabled={!weight || logPending}
            onClick={logWeight}
          >
            {logPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <Plus className="size-4" /> Log
              </>
            )}
          </Button>
        </div>
      </div>

      {recent.length > 0 && (
        <ul className="divide-y rounded-lg border text-sm">
          {recent.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center justify-between gap-2 px-3 py-1.5"
            >
              <span className="text-muted-foreground">{entry.date}</span>
              <span className="ml-auto font-medium tabular-nums">
                {entry.weightKg} kg
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Edit weigh-in from ${entry.date}`}
                className="size-8 text-muted-foreground"
                onClick={() => {
                  setDate(entry.date);
                  setWeight(String(entry.weightKg));
                }}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete weigh-in from ${entry.date}`}
                className="size-8 text-muted-foreground hover:text-destructive"
                onClick={() => deleteMutation.mutate(entry.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
