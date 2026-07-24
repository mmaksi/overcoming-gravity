"use client";

import { useState } from "react";
import {
  addedLoadForReps,
  loadForReps,
  LOAD_TABLE_REPS,
  percentOfMax,
} from "@/lib/domain/tools";
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

/**
 * The inverse of the 1RM calculator: given a max, what to load for a rep
 * target. Shows the whole Epley curve at once rather than asking for a single
 * target — an athlete picking today's working weight wants to see the
 * neighbouring rows too.
 */
export function LoadForReps({
  initialBodyweight,
}: {
  initialBodyweight?: number;
}) {
  const [mode, setMode] = useState<Mode>("barbell");
  const [oneRm, setOneRm] = useState("");
  const [bodyweight, setBodyweight] = useState(
    initialBodyweight != null ? trim(initialBodyweight) : "",
  );

  const oneRmNum = Number(oneRm || 0);
  const bodyweightNum = Number(bodyweight || 0);

  // Barbell: the bar's whole 1RM. Weighted calisthenics: the 1RM as *added*
  // load, so bodyweight has to be in hand before any row can be computed.
  const load = (reps: number) =>
    mode === "barbell"
      ? loadForReps(oneRmNum, reps)
      : addedLoadForReps(bodyweightNum, oneRmNum, reps);

  const hasResult =
    mode === "barbell" ? oneRmNum > 0 : bodyweightNum > 0 && oneRm !== "";

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

      <div
        className={mode === "barbell" ? "space-y-2" : "grid grid-cols-2 gap-3"}
      >
        {mode === "calisthenics" && (
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
        )}
        <div className="space-y-2">
          <Label htmlFor="one-rm">
            {mode === "barbell"
              ? `1 rep max (${UNIT})`
              : `1RM — added weight (${UNIT})`}
          </Label>
          <Input
            id="one-rm"
            type="number"
            inputMode="decimal"
            placeholder={mode === "barbell" ? "e.g. 120" : "e.g. 30"}
            value={oneRm}
            onChange={(e) => setOneRm(e.target.value)}
          />
        </div>
      </div>

      {hasResult && (
        <Card>
          <CardContent className="px-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 pb-2 text-left font-semibold">Reps</th>
                  <th className="px-4 pb-2 text-right font-semibold">
                    {mode === "barbell" ? "Load" : "Added weight"}
                  </th>
                  {mode === "barbell" && (
                    <th className="px-4 pb-2 text-right font-semibold">
                      % of 1RM
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {LOAD_TABLE_REPS.map((reps) => {
                  const value = load(reps);
                  return (
                    <tr key={reps} className="border-b last:border-0">
                      <td className="px-4 py-2 font-medium tabular-nums">
                        {reps}
                      </td>
                      <td className="px-4 py-2 text-right font-bold tabular-nums text-primary">
                        {value < 0 ? (
                          <span className="font-medium text-muted-foreground">
                            {trim(-value)} {UNIT} assistance
                          </span>
                        ) : (
                          `${trim(value)} ${UNIT}`
                        )}
                      </td>
                      {mode === "barbell" && (
                        <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                          {Math.round(percentOfMax(reps))}%
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {hasResult && mode === "calisthenics" && (
        <p className="text-xs text-muted-foreground">
          Rows below your bodyweight show up as assistance — that rep target is
          out of reach unloaded, so take that much off with a band or a
          counterweight.
        </p>
      )}
    </div>
  );
}
