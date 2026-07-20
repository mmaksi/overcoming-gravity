import Link from "next/link";
import {
  Activity,
  ChartLine,
  Crosshair,
  Flame,
  TrendingDown,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { bmiOf, BodyweightEntry } from "@/lib/domain/schemas";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GoalsAchievedCount } from "@/components/home/goals-achieved";

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

/**
 * The "Stats" block on Home: the workout streak and the all-time achieved
 * goals side by side on top, then the bodyweight chart and BMI card as two
 * equal cards. Read-only — weigh-ins, height and target weight are logged in
 * Settings; goals are ticked on the dashboard's goals card.
 */
export function StatsSection({
  entries,
  heightCm,
  targetWeightKg,
  streak,
  totalWorkouts,
  goalsAchieved,
}: {
  entries: BodyweightEntry[];
  heightCm?: number;
  targetWeightKg?: number;
  streak: number;
  totalWorkouts: number;
  /** Goals ticked off across all programs, lifetime. */
  goalsAchieved: number;
}) {
  const latest = entries.at(-1);
  const first = entries[0];
  const change =
    latest && first && entries.length > 1
      ? latest.weightKg - first.weightKg
      : 0;

  const bmi = bmiOf(latest?.weightKg, heightCm);
  const targetBmi = bmiOf(targetWeightKg, heightCm);

  return (
    <div className="space-y-3">
      <h2 className="flex items-center gap-2 text-base font-semibold uppercase tracking-wide text-primary">
        <Activity className="size-5" /> Stats
      </h2>

      {/* Streak and lifetime achieved goals sit on top, side by side. */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="gap-2 py-4">
          <CardHeader className="px-4">
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <Flame className="size-4 text-primary" /> Streak
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold tabular-nums">{streak}</span>
              <span className="text-sm font-medium text-muted-foreground">
                in a row
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {streak === 0
                ? "Complete your next workout to start a streak."
                : `${totalWorkouts} workout${totalWorkouts === 1 ? "" : "s"} completed all-time`}
            </p>
          </CardContent>
        </Card>

        <Card className="gap-2 py-4">
          <CardHeader className="px-4">
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <Trophy className="size-4 text-primary" /> Goals achieved
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold tabular-nums">
                <GoalsAchievedCount fallback={goalsAchieved} />
              </span>
              <span className="text-sm font-medium text-muted-foreground">
                all-time
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {goalsAchieved === 0
                ? "Tick off program goals below as you reach them."
                : "Program goals ticked off since you started."}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="gap-2 py-4">
          <CardHeader className="px-4">
            <CardTitle className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5">
                <ChartLine className="size-4 text-primary" /> Bodyweight
              </span>
              {latest && (
                <span className="font-bold tabular-nums">
                  {latest.weightKg} kg
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 px-4">
            {entries.length > 0 ? (
              <>
                <WeightChart entries={entries} />
                {change !== 0 && (
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    {change < 0 ? (
                      <TrendingDown className="size-3.5 text-emerald-600" />
                    ) : (
                      <TrendingUp className="size-3.5 text-orange-600" />
                    )}
                    {change > 0 ? "+" : ""}
                    {change.toFixed(1)} kg since {first?.date}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                <Link href="/settings" className="text-primary underline">
                  Log your weight in Settings
                </Link>{" "}
                to see it charted here.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="gap-2 py-4">
          <CardHeader className="px-4">
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <Crosshair className="size-4 text-primary" /> BMI
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 px-4">
            {bmi != null ? (
              <>
                <div>
                  <div className="text-2xl font-bold tabular-nums">{bmi}</div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Current
                  </div>
                </div>
                {targetBmi != null && (
                  <div>
                    <div className="text-lg font-semibold tabular-nums text-primary">
                      {targetBmi}
                    </div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Target
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                <Link href="/settings" className="text-primary underline">
                  Add your height
                  {latest ? "" : " and weight"}
                </Link>{" "}
                for BMI.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
