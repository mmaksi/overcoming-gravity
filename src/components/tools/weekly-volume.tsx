import { WeekVolume } from "@/lib/domain/volume";
import { parseISODate } from "@/lib/domain/schedule";
import {
  CATEGORIES,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  Category,
} from "@/lib/domain/types";
import { Card, CardContent } from "@/components/ui/card";

/** "Jul 20" — the Monday a week runs from. */
function weekLabel(weekStart: string, index: number): string {
  if (index === 0) return "This week";
  if (index === 1) return "Last week";
  return parseISODate(weekStart).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Working sets per movement pattern, one stacked bar per calendar week. Bars
 * are scaled against the busiest week in the window rather than a fixed
 * ceiling — the question this answers is how the weeks compare to each other,
 * and how push, pull and legs compare within each.
 */
export function WeeklyVolume({ weeks }: { weeks: WeekVolume[] }) {
  const busiest = Math.max(...weeks.map((w) => w.total));
  const windowTotals = Object.fromEntries(
    CATEGORIES.map((c) => [c, weeks.reduce((n, w) => n + w.sets[c], 0)]),
  ) as Record<Category, number>;
  const trained = CATEGORIES.filter((c) => windowTotals[c] > 0);

  if (busiest === 0) {
    return (
      <Card>
        <CardContent className="space-y-1 py-2 text-center">
          <p className="font-medium">No volume logged yet</p>
          <p className="text-sm text-muted-foreground">
            Complete a workout and your sets show up here, split by pattern.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {trained.map((category) => (
          <span
            key={category}
            className="flex items-center gap-1.5 text-sm text-muted-foreground"
          >
            <span
              className={`size-2.5 rounded-full ${CATEGORY_COLORS[category]}`}
            />
            {CATEGORY_LABELS[category]}
            <span className="font-semibold tabular-nums text-foreground">
              {windowTotals[category]}
            </span>
          </span>
        ))}
      </div>

      <div className="space-y-3">
        {weeks.map((week, index) => (
          <div key={week.weekStart} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-medium">
                {weekLabel(week.weekStart, index)}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {week.total === 0
                  ? "—"
                  : `${plural(week.total, "set")} · ${plural(week.workouts, "workout")}`}
              </span>
            </div>
            <div className="flex h-3 w-full gap-px overflow-hidden rounded-full bg-muted">
              {CATEGORIES.map((category) =>
                week.sets[category] > 0 ? (
                  <div
                    key={category}
                    className={CATEGORY_COLORS[category]}
                    style={{
                      width: `${(week.sets[category] / busiest) * 100}%`,
                    }}
                    title={`${CATEGORY_LABELS[category]}: ${plural(week.sets[category], "set")}`}
                  />
                ) : null,
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
