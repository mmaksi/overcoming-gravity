"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { GROUP_TYPE_LABELS, GroupType } from "@/lib/domain/types";
import { ExerciseGroup } from "@/lib/domain/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * A mode's timing/shape settings, chosen at workout time (the designer only
 * picks the mode). Which fields matter depends on the mode: superset — rest
 * after each round; HIIT — work/rest/rounds; pyramid & ladder — the climb's
 * start, increment and interval. Settings live in the logger's client state
 * (persisted per session in localStorage), never on the plan.
 */
export type ModeSettings = {
  restSeconds?: number;
  workSeconds?: number;
  rounds?: number;
  startReps?: number;
  increment?: number;
  intervalSeconds?: number;
};

/** Modes with settings to adjust at workout time (the rest have none). */
export function isConfigurableMode(type: GroupType): boolean {
  return (
    type === "superset" ||
    type === "hiit" ||
    type === "pyramid" ||
    type === "ladder"
  );
}

/**
 * A group's starting settings: mode defaults, overridden by whatever the
 * plan still carries from the legacy design-time config dialog.
 */
export function seedModeSettings(group: ExerciseGroup): ModeSettings {
  switch (group.type) {
    case "superset":
      return { restSeconds: group.restSeconds ?? 90 };
    case "hiit":
      return {
        workSeconds: group.workSeconds ?? 30,
        restSeconds: group.restSeconds ?? 30,
        rounds: group.rounds ?? 8,
      };
    case "pyramid":
    case "ladder":
      return { startReps: 1, increment: 1, intervalSeconds: 60 };
    default:
      return {};
  }
}

/** "90s" for odd amounts, "2 min" for whole minutes. */
function shortDuration(seconds: number): string {
  return seconds % 60 === 0 ? `${seconds / 60} min` : `${seconds}s`;
}

/** Compact summary shown beside the mode badge in the logger. */
export function modeSettingsSummary(
  type: GroupType,
  s: ModeSettings,
): string | null {
  switch (type) {
    case "superset":
      return s.restSeconds ? `rest ${shortDuration(s.restSeconds)}` : null;
    case "pyramid":
    case "ladder":
      return `from ${s.startReps ?? 1} by ${s.increment ?? 1} · every ${shortDuration(
        s.intervalSeconds ?? 60,
      )}`;
    case "hiit": {
      if (!s.workSeconds || !s.restSeconds || !s.rounds) return null;
      const totalMin = (s.rounds * (s.workSeconds + s.restSeconds)) / 60;
      const total = Number.isInteger(totalMin)
        ? String(totalMin)
        : totalMin.toFixed(1);
      return `${s.workSeconds}s/${s.restSeconds}s × ${s.rounds} · ${total} min total`;
    }
    case "tabata":
      return "20s/10s × 8 · 4 min total";
    default:
      return null;
  }
}

/** Ready-to-pick superset rest values; any other value can be typed. */
const SUPERSET_REST_PRESETS = [
  { seconds: 60, label: "1 min" },
  { seconds: 90, label: "90s" },
  { seconds: 120, label: "2 min" },
  { seconds: 180, label: "3 min" },
  { seconds: 240, label: "4 min" },
  { seconds: 300, label: "5 min" },
];

function NumberField({
  id,
  label,
  value,
  onChange,
  suffix,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  suffix?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        />
        {suffix && (
          <span className="shrink-0 text-sm text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * Adjust a mode's settings mid-workout (the gear next to the mode badge).
 * The parent remounts this dialog per opening (key on the component), so
 * plain initial state is enough. Text state keeps inputs clearable.
 */
export function ModeSettingsDialog({
  type,
  value,
  onOpenChange,
  onSave,
}: {
  /** The mode being configured; null keeps the dialog closed. */
  type: GroupType | null;
  value: ModeSettings;
  onOpenChange: (open: boolean) => void;
  onSave: (settings: ModeSettings) => void;
}) {
  const [restSeconds, setRestSeconds] = useState(
    String(value.restSeconds ?? 90),
  );
  const [workSeconds, setWorkSeconds] = useState(
    String(value.workSeconds ?? 30),
  );
  const [rounds, setRounds] = useState(String(value.rounds ?? 8));
  const [startReps, setStartReps] = useState(String(value.startReps ?? 1));
  const [increment, setIncrement] = useState(String(value.increment ?? 1));
  const [intervalSeconds, setIntervalSeconds] = useState(
    String(value.intervalSeconds ?? 60),
  );

  const num = (v: string, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : fallback;
  };

  const hiitTotalMin =
    (num(rounds, 8) * (num(workSeconds, 30) + num(restSeconds, 30))) / 60;
  const climbing = type === "pyramid" || type === "ladder";

  function save() {
    if (!type) return;
    if (type === "superset") {
      onSave({ restSeconds: num(restSeconds, 90) });
    } else if (climbing) {
      onSave({
        startReps: num(startReps, 1),
        increment: num(increment, 1),
        intervalSeconds: num(intervalSeconds, 60),
      });
    } else {
      onSave({
        workSeconds: num(workSeconds, 30),
        restSeconds: num(restSeconds, 30),
        rounds: num(rounds, 8),
      });
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={type !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {type ? GROUP_TYPE_LABELS[type] : ""} settings
          </DialogTitle>
          {climbing && (
            <DialogDescription>
              Start a step every interval: do the step&apos;s reps, then rest
              until the next one begins.
            </DialogDescription>
          )}
        </DialogHeader>

        {type === "superset" && (
          <div className="space-y-2">
            <Label htmlFor="mode-rest">Rest after each round of the pair</Label>
            <div className="flex flex-wrap gap-1.5">
              {SUPERSET_REST_PRESETS.map((preset) => (
                <button
                  key={preset.seconds}
                  type="button"
                  aria-pressed={restSeconds === String(preset.seconds)}
                  onClick={() => setRestSeconds(String(preset.seconds))}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                    restSeconds === String(preset.seconds)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "hover:border-foreground/30",
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Input
                id="mode-rest"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={restSeconds}
                onChange={(e) =>
                  setRestSeconds(e.target.value.replace(/\D/g, ""))
                }
              />
              <span className="shrink-0 text-sm text-muted-foreground">
                seconds
              </span>
            </div>
          </div>
        )}

        {climbing && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                id="climb-start"
                label="Start at"
                value={startReps}
                onChange={setStartReps}
                suffix="reps"
              />
              <NumberField
                id="climb-increment"
                label="Go up by"
                value={increment}
                onChange={setIncrement}
                suffix="reps"
              />
            </div>
            <NumberField
              id="climb-interval"
              label="Interval"
              value={intervalSeconds}
              onChange={setIntervalSeconds}
              suffix="seconds"
              hint={`e.g. every 60s: ${num(startReps, 1)} reps, rest · ${
                num(startReps, 1) + num(increment, 1)
              } reps, rest · ${
                num(startReps, 1) + 2 * num(increment, 1)
              } reps, rest…`}
            />
          </div>
        )}

        {type === "hiit" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                id="hiit-work"
                label="Work (seconds)"
                value={workSeconds}
                onChange={setWorkSeconds}
              />
              <NumberField
                id="hiit-rest"
                label="Rest (seconds)"
                value={restSeconds}
                onChange={setRestSeconds}
              />
            </div>
            <NumberField
              id="hiit-rounds"
              label="Rounds"
              value={rounds}
              onChange={setRounds}
            />
            <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
              Total:{" "}
              <span className="font-semibold tabular-nums">
                {Number.isInteger(hiitTotalMin)
                  ? hiitTotalMin
                  : hiitTotalMin.toFixed(1)}{" "}
                minutes
              </span>
            </p>
          </div>
        )}

        <Button className="w-full" onClick={save}>
          <Check className="size-4" /> Save settings
        </Button>
      </DialogContent>
    </Dialog>
  );
}
