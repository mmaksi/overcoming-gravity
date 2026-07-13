"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { BodyweightEntry } from "@/lib/domain/schemas";
import { deleteBodyweight, saveBodyweight } from "@/lib/actions/bodyweight";
import { saveBodyStats } from "@/lib/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Body measurements, all editable in Settings: height and target weight
 * (the BMI inputs), plus the bodyweight log — any date, including past days;
 * logging an already-logged date overwrites that day's entry.
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
  const [statsPending, startStats] = useTransition();
  const [statsSaved, setStatsSaved] = useState(false);

  const [date, setDate] = useState(today);
  const [weight, setWeight] = useState("");
  const [logPending, startLog] = useTransition();

  const [error, setError] = useState<string | null>(null);

  function saveStats() {
    setStatsSaved(false);
    setError(null);
    startStats(async () => {
      try {
        await saveBodyStats({
          heightCm: height.trim() === "" ? null : Number(height),
          targetWeightKg: target.trim() === "" ? null : Number(target),
        });
        setStatsSaved(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save");
      }
    });
  }

  function logWeight() {
    const weightKg = Number(weight);
    if (!weightKg || weightKg <= 0 || !date) return;
    setError(null);
    startLog(async () => {
      try {
        await saveBodyweight({ date, weightKg });
        setWeight("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save");
      }
    });
  }

  // Newest first; keep the list short — the chart on Home shows the trend.
  const recent = [...entries].reverse().slice(0, 8);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="height-cm">Height (cm)</Label>
            <Input
              id="height-cm"
              type="number"
              inputMode="decimal"
              min={0}
              placeholder="175"
              value={height}
              onChange={(e) => {
                setHeight(e.target.value);
                setStatsSaved(false);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="target-weight">Target weight (kg)</Label>
            <Input
              id="target-weight"
              type="number"
              inputMode="decimal"
              step={0.1}
              min={0}
              placeholder="72.0"
              value={target}
              onChange={(e) => {
                setTarget(e.target.value);
                setStatsSaved(false);
              }}
            />
          </div>
        </div>
        <Button
          variant="outline"
          className="w-full"
          disabled={statsPending}
          onClick={saveStats}
        >
          {statsPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : statsSaved ? (
            <>
              <Check className="size-4" /> Saved
            </>
          ) : (
            "Save height & target"
          )}
        </Button>
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
        <p className="text-xs text-muted-foreground">
          Pick any date to add or correct a past weigh-in — one entry per day.
        </p>
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
                onClick={() =>
                  startLog(() =>
                    deleteBodyweight(entry.id).catch(() => undefined),
                  )
                }
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
