"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Weekday, WEEKDAY_LABELS } from "@/lib/domain/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function ToggleRow({
  label,
  selected,
  onToggle,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "hover:border-foreground/30",
      )}
    >
      {label}
      {selected && <Check className="size-4 text-primary" />}
    </button>
  );
}

export function CopyDayDialog({
  open,
  onOpenChange,
  source,
  targets,
  onCopy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: Weekday | null;
  targets: Weekday[];
  onCopy: (targets: Weekday[]) => void;
}) {
  const [selected, setSelected] = useState<Weekday[]>([]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setSelected([]);
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Copy {source ? WEEKDAY_LABELS[source] : ""}&apos;s workout
          </DialogTitle>
          <DialogDescription>
            Overwrites the selected days of this week with a copy.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {targets.map((day) => (
            <ToggleRow
              key={day}
              label={WEEKDAY_LABELS[day]}
              selected={selected.includes(day)}
              onToggle={() =>
                setSelected((s) =>
                  s.includes(day) ? s.filter((d) => d !== day) : [...s, day],
                )
              }
            />
          ))}
        </div>
        <DialogFooter>
          <Button
            disabled={selected.length === 0}
            onClick={() => {
              onCopy(selected);
              setSelected([]);
              onOpenChange(false);
            }}
          >
            Copy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CopyWeekDialog({
  open,
  onOpenChange,
  sourceIndex,
  weekCount,
  deloadIndex,
  onCopy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceIndex: number;
  weekCount: number;
  deloadIndex: number;
  onCopy: (targets: number[]) => void;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const targets = Array.from({ length: weekCount }, (_, i) => i).filter(
    (i) => i !== sourceIndex,
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setSelected([]);
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Copy week {sourceIndex + 1}</DialogTitle>
          <DialogDescription>
            Overwrites all workouts of the selected weeks with a copy.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {targets.map((i) => (
            <ToggleRow
              key={i}
              label={`Week ${i + 1}${i === deloadIndex ? " (deload)" : ""}`}
              selected={selected.includes(i)}
              onToggle={() =>
                setSelected((s) =>
                  s.includes(i) ? s.filter((x) => x !== i) : [...s, i],
                )
              }
            />
          ))}
        </div>
        <DialogFooter>
          <Button
            disabled={selected.length === 0}
            onClick={() => {
              onCopy(selected);
              setSelected([]);
              onOpenChange(false);
            }}
          >
            Copy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
