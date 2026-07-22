"use client";

import { useState } from "react";
import {
  formatSweetSpot,
  isometricSweetSpot,
  MAX_HOLD_MAX,
  MAX_HOLD_MIN,
} from "@/lib/domain/tools";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export function IsometricSweetSpot() {
  const [value, setValue] = useState("");

  const parsed = Number(value);
  const isValid = value.trim() !== "" && Number.isFinite(parsed) && parsed >= 1;
  const spot = isValid ? isometricSweetSpot(parsed) : null;
  const clamped = isValid && parsed > MAX_HOLD_MAX;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="max-hold">Your max hold (seconds)</Label>
        <Input
          id="max-hold"
          type="number"
          inputMode="decimal"
          min={MAX_HOLD_MIN}
          step={1}
          placeholder="e.g. 10"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          The longest you can currently hold the position with good form.
        </p>
      </div>

      {spot && (
        <Card>
          <CardContent className="space-y-1 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Your sweet spot
            </p>
            <p className="font-heading text-4xl font-bold text-primary">
              {formatSweetSpot(spot)}
            </p>
            <p className="text-sm text-muted-foreground">
              {spot.sets} sets of {spot.hold}-second{" "}
              {spot.hold === 1 ? "hold" : "holds"}
            </p>
            {clamped && (
              <p className="pt-1 text-xs text-muted-foreground">
                Capped at a {MAX_HOLD_MAX}s max hold — the top of the range.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
