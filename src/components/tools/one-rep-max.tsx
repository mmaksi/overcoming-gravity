"use client";

import { useState } from "react";
import { oneRepMax, weightedOneRepMax } from "@/lib/domain/tools";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { FilterChip } from "@/components/ui/filter-chip";

type Mode = "barbell" | "calisthenics";

const UNIT = "kg";

/** Rounds to at most one decimal, dropping a trailing ".0". */
function trim(value: number): string {
  return value
    .toFixed(1)
    .replace(/\.0$/, "")
    .replace(/(\.\d)0$/, "$1");
}

export function OneRepMax({
  initialBodyweight,
}: {
  initialBodyweight?: number;
}) {
  const [mode, setMode] = useState<Mode>("barbell");
  const [weight, setWeight] = useState("");
  const [bodyweight, setBodyweight] = useState(
    initialBodyweight != null ? trim(initialBodyweight) : "",
  );
  const [added, setAdded] = useState("");
  const [reps, setReps] = useState("");

  const repCount = Number(reps);
  const bodyweightNum = Number(bodyweight || 0);
  const totalWeight =
    mode === "barbell" ? Number(weight) : bodyweightNum + Number(added || 0);

  // Barbell: the whole loaded weight. Weighted calisthenics: the *added* load
  // only — bodyweight is subtracted back out inside weightedOneRepMax.
  const oneRm =
    mode === "barbell"
      ? oneRepMax(totalWeight, repCount)
      : weightedOneRepMax(bodyweightNum, Number(added || 0), repCount);
  const hasResult = oneRm > 0 && Number.isFinite(oneRm);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <FilterChip
          label="Barbell / weight"
          active={mode === "barbell"}
          onClick={() => setMode("barbell")}
        />
        <FilterChip
          label="Weighted calisthenics"
          active={mode === "calisthenics"}
          onClick={() => setMode("calisthenics")}
        />
      </div>

      {mode === "barbell" ? (
        <div className="space-y-2">
          <Label htmlFor="weight">Weight lifted ({UNIT})</Label>
          <Input
            id="weight"
            type="number"
            inputMode="decimal"
            min={0}
            placeholder="e.g. 80"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="bodyweight">Bodyweight ({UNIT})</Label>
            <Input
              id="bodyweight"
              type="number"
              inputMode="decimal"
              min={0}
              placeholder="e.g. 75"
              value={bodyweight}
              onChange={(e) => setBodyweight(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="added">Added weight ({UNIT})</Label>
            <Input
              id="added"
              type="number"
              inputMode="decimal"
              min={0}
              placeholder="e.g. 20"
              value={added}
              onChange={(e) => setAdded(e.target.value)}
            />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="reps">Reps performed</Label>
        <Input
          id="reps"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          placeholder="e.g. 5"
          value={reps}
          onChange={(e) => setReps(e.target.value)}
        />
      </div>

      {hasResult && (
        <Card>
          <CardContent className="space-y-1 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {mode === "barbell"
                ? "Estimated 1 rep max"
                : "Estimated 1RM — added weight"}
            </p>
            <p className="font-heading text-4xl font-bold text-primary">
              {trim(oneRm)} {UNIT}
            </p>
            <p className="text-sm text-muted-foreground">
              from {trim(totalWeight)} {UNIT} × {repCount}{" "}
              {repCount === 1 ? "rep" : "reps"}
              {mode === "calisthenics" &&
                `, incl. ${trim(bodyweightNum)} ${UNIT} bodyweight`}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
