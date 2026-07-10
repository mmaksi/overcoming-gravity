"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function ChoiceCard({
  title,
  description,
  selected,
  onSelect,
  disabled,
}: {
  title: string;
  description?: string;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "w-full rounded-xl border p-4 text-left transition-colors",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "hover:border-foreground/30",
        disabled && "opacity-50",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold">{title}</div>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {selected && <Check className="mt-1 size-5 shrink-0 text-primary" />}
      </div>
    </button>
  );
}
