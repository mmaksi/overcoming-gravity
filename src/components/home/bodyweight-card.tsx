"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, TrendingDown, TrendingUp } from "lucide-react";
import { BodyweightEntry } from "@/lib/domain/schemas";
import { saveBodyweight } from "@/lib/actions/bodyweight";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** Simple responsive SVG line chart of weight over time. */
function WeightChart({ entries }: { entries: BodyweightEntry[] }) {
  const W = 320;
  const H = 96;
  const pad = 6;
  const weights = entries.map((e) => e.weightKg);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const span = max - min || 1;

  const points = entries.map((e, i) => {
    const x =
      entries.length === 1
        ? W / 2
        : pad + (i / (entries.length - 1)) * (W - 2 * pad);
    const y = H - pad - ((e.weightKg - min) / span) * (H - 2 * pad);
    return { x, y };
  });
  const path = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-24 w-full"
      preserveAspectRatio="none"
      role="img"
      aria-label="Bodyweight over time"
    >
      <polyline
        points={path}
        fill="none"
        stroke="var(--primary)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="var(--primary)" />
      ))}
    </svg>
  );
}

export function BodyweightCard({
  entries,
  today,
}: {
  entries: BodyweightEntry[];
  today: string;
}) {
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const latest = entries.at(-1);
  const first = entries[0];
  const change =
    latest && first && entries.length > 1
      ? latest.weightKg - first.weightKg
      : 0;

  function add() {
    const weightKg = Number(value);
    if (!weightKg || weightKg <= 0) return;
    setError(null);
    startTransition(async () => {
      try {
        await saveBodyweight({ date: today, weightKg });
        setValue("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Bodyweight</span>
          {latest && (
            <span className="text-lg font-bold tabular-nums">
              {latest.weightKg} kg
            </span>
          )}
        </CardTitle>
        <CardDescription>
          {entries.length === 0
            ? "Log your weight to track it over time."
            : change === 0
              ? "Steady since you started tracking."
              : (
                <span className="inline-flex items-center gap-1">
                  {change < 0 ? (
                    <TrendingDown className="size-3.5 text-emerald-600" />
                  ) : (
                    <TrendingUp className="size-3.5 text-orange-600" />
                  )}
                  {change > 0 ? "+" : ""}
                  {change.toFixed(1)} kg since {first?.date}
                </span>
              )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {entries.length > 0 && <WeightChart entries={entries} />}
        <div className="flex gap-2">
          <Input
            type="number"
            inputMode="decimal"
            step={0.1}
            min={0}
            placeholder="Today's weight (kg)"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <Button className="shrink-0" disabled={!value || pending} onClick={add}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <Plus className="size-4" /> Log
              </>
            )}
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
