"use client";

import { Weekday, WEEKDAY_SHORT, WEEKDAYS } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export function WeekdayPicker({
  value,
  onChange,
  disabledDays = [],
  disabledHint,
}: {
  value: Weekday[];
  onChange: (days: Weekday[]) => void;
  disabledDays?: Weekday[];
  disabledHint?: string;
}) {
  function toggle(day: Weekday) {
    onChange(
      value.includes(day) ? value.filter((d) => d !== day) : [...value, day],
    );
  }

  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((day) => {
          const selected = value.includes(day);
          const disabled = disabledDays.includes(day);
          return (
            <button
              key={day}
              type="button"
              disabled={disabled}
              onClick={() => toggle(day)}
              aria-pressed={selected}
              className={cn(
                "rounded-lg border py-2 text-xs font-medium transition-colors",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:border-foreground/30",
                disabled && "cursor-not-allowed opacity-40",
              )}
            >
              {WEEKDAY_SHORT[day]}
            </button>
          );
        })}
      </div>
      {disabledDays.length > 0 && disabledHint && (
        <p className="mt-1.5 text-xs text-muted-foreground">{disabledHint}</p>
      )}
    </div>
  );
}
