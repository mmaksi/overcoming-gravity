"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { GROUP_TYPE_LABELS } from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GroupConfig } from "./meso-utils";
import { cn } from "@/lib/utils";

/** Ready-to-pick superset rest values; any other value can be typed. */
const SUPERSET_REST_PRESETS = [
  { seconds: 60, label: "1 min" },
  { seconds: 90, label: "90s" },
  { seconds: 120, label: "2 min" },
  { seconds: 180, label: "3 min" },
  { seconds: 240, label: "4 min" },
  { seconds: 300, label: "5 min" },
];

/** Modes whose settings must be collected before the group is created. */
export type ConfigurableGroupType = "superset" | "pyramid" | "ladder" | "hiit";

/**
 * Collects a mode's settings when the athlete picks it: superset group rest,
 * pyramid/ladder steps + step rest, HIIT work/rest/rounds with a live total.
 * Modes without settings (to-failure, circuit, Tabata's fixed 20/10 × 8)
 * never open this dialog.
 */
export function GroupConfigDialog({
  type,
  onOpenChange,
  onConfirm,
}: {
  /** The mode being configured; null keeps the dialog closed. */
  type: ConfigurableGroupType | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (config: GroupConfig) => void;
}) {
  // The parent remounts this dialog per opening (key on the component), so
  // plain initial state is enough. Text state keeps inputs clearable.
  const [restSeconds, setRestSeconds] = useState("90");
  const [steps, setSteps] = useState("5");
  const [stepRest, setStepRest] = useState("60");
  const [workSeconds, setWorkSeconds] = useState("30");
  const [hiitRest, setHiitRest] = useState("30");
  const [rounds, setRounds] = useState("8");

  const num = (v: string, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : fallback;
  };

  const hiitTotalMin =
    (num(rounds, 8) * (num(workSeconds, 30) + num(hiitRest, 30))) / 60;

  function confirm() {
    if (!type) return;
    if (type === "superset") {
      onConfirm({ restSeconds: num(restSeconds, 90) });
    } else if (type === "pyramid" || type === "ladder") {
      onConfirm({
        steps: Math.max(2, num(steps, 5)),
        restSeconds: num(stepRest, 60),
      });
    } else {
      onConfirm({
        workSeconds: num(workSeconds, 30),
        restSeconds: num(hiitRest, 30),
        rounds: num(rounds, 8),
      });
    }
  }

  return (
    <Dialog open={type !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {type ? GROUP_TYPE_LABELS[type] : ""} settings
          </DialogTitle>
        </DialogHeader>

        {type === "superset" && (
          <div className="space-y-2">
            <Label htmlFor="group-rest">
              Rest after each round of the pair
            </Label>
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
                id="group-rest"
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

        {(type === "pyramid" || type === "ladder") && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="group-steps">Steps</Label>
              <Input
                id="group-steps"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={steps}
                onChange={(e) => setSteps(e.target.value.replace(/\D/g, ""))}
              />
              <p className="text-xs text-muted-foreground">
                Each step is one set — you&apos;ll log your reps per step as
                usual.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="group-step-rest">Rest between steps</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="group-step-rest"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={stepRest}
                  onChange={(e) =>
                    setStepRest(e.target.value.replace(/\D/g, ""))
                  }
                />
                <span className="shrink-0 text-sm text-muted-foreground">
                  seconds
                </span>
              </div>
            </div>
          </div>
        )}

        {type === "hiit" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="hiit-work">Work (seconds)</Label>
                <Input
                  id="hiit-work"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={workSeconds}
                  onChange={(e) =>
                    setWorkSeconds(e.target.value.replace(/\D/g, ""))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hiit-rest">Rest (seconds)</Label>
                <Input
                  id="hiit-rest"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={hiitRest}
                  onChange={(e) =>
                    setHiitRest(e.target.value.replace(/\D/g, ""))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hiit-rounds">Rounds</Label>
              <Input
                id="hiit-rounds"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={rounds}
                onChange={(e) => setRounds(e.target.value.replace(/\D/g, ""))}
              />
            </div>
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

        <Button className="w-full" onClick={confirm}>
          <Check className="size-4" /> Apply mode
        </Button>
      </DialogContent>
    </Dialog>
  );
}
