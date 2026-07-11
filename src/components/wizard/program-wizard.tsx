"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Loader2, Plus, X } from "lucide-react";
import {
  GOAL_AREA_LABELS,
  GOAL_AREAS,
  GoalArea,
  MAX_WEEKS,
  MIN_WEEKS,
  Periodization,
  PERIODIZATION_LABELS,
  ProgramType,
  PROGRAM_TYPE_LABELS,
  SplitType,
  SPLIT_TYPE_LABELS,
  Weekday,
} from "@/lib/domain/types";
import { WizardPayload } from "@/lib/domain/wizard";
import { createProgramFromWizard } from "@/lib/actions/programs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ChoiceCard } from "./choice-card";
import { WeekdayPicker } from "./weekday-picker";
import { cn } from "@/lib/utils";

const STEPS = ["Basics", "Goals", "Periodization", "Schedule"] as const;

const GOAL_PLACEHOLDERS: Record<GoalArea, string> = {
  skills: "e.g. Hold a 10s front lever",
  push: "e.g. 5 clean dips",
  pull: "e.g. First muscle-up",
};

const TYPE_DESCRIPTIONS: Record<ProgramType, string> = {
  full_body:
    "Train the whole body every session. Great frequency for skills and strength.",
  split:
    "Divide training across days: straight/bent arm, push/pull or upper/lower.",
  sport_mix:
    "Combine calisthenics with another sport — we schedule around your sport days.",
};

const PERIODIZATION_DESCRIPTIONS: Record<Periodization, string> = {
  none: "The same workout repeats every training day. Simple and effective — you progress by adding reps, sets or weight over the weeks.",
  daily_undulating:
    "Intensity and volume change from workout to workout within the same week: for example Monday heavy with low reps, Wednesday light with high reps, Friday in between. You vary the stimulus day to day and train each quality more often.",
  high_low:
    "Days are strictly divided into demanding HIGH sessions and easy LOW sessions, with at least 48h between hard days. Fewer but harder peaks, and the low days guarantee recovery.",
};

export function ProgramWizard() {
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [type, setType] = useState<ProgramType | null>(null);
  const [splitType, setSplitType] = useState<SplitType | null>(null);
  const [sportName, setSportName] = useState("");
  const [sportDays, setSportDays] = useState<Weekday[]>([]);
  const [periodization, setPeriodization] = useState<Periodization | null>(
    null,
  );
  const [trainingDays, setTrainingDays] = useState<Weekday[]>([]);
  const [weeks, setWeeks] = useState(6);
  const [goals, setGoals] = useState<Record<GoalArea, string[]>>({
    skills: [""],
    push: [""],
    pull: [""],
  });

  // One goal in total (any area) is enough to continue.
  const goalsValid = GOAL_AREAS.some((area) =>
    goals[area].some((g) => g.trim()),
  );

  const stepValid = useMemo(() => {
    switch (step) {
      case 0:
        if (!name.trim() || !type) return false;
        if (type === "split" && !splitType) return false;
        if (type === "sport_mix" && (!sportName.trim() || sportDays.length === 0))
          return false;
        return true;
      case 1:
        return goalsValid;
      case 2:
        return periodization !== null;
      case 3:
        return trainingDays.length > 0;
      default:
        return false;
    }
  }, [step, name, type, splitType, sportName, sportDays, goalsValid, periodization, trainingDays]);

  function setGoal(area: GoalArea, index: number, value: string) {
    setGoals((g) => ({
      ...g,
      [area]: g[area].map((x, i) => (i === index ? value : x)),
    }));
  }

  function cleanGoals(area: GoalArea): string[] {
    return goals[area].map((g) => g.trim()).filter(Boolean).slice(0, 2);
  }

  function finish() {
    if (!type || !periodization) return;
    const payload: WizardPayload = {
      name: name.trim(),
      type,
      splitType: type === "split" ? (splitType ?? undefined) : undefined,
      sport:
        type === "sport_mix"
          ? { name: sportName.trim(), days: sportDays }
          : undefined,
      goals: {
        skills: cleanGoals("skills"),
        push: cleanGoals("push"),
        pull: cleanGoals("pull"),
      },
      periodization,
      trainingDays,
      weeks,
    };
    setError(null);
    startTransition(async () => {
      try {
        await createProgramFromWizard(payload);
      } catch (e) {
        // Next.js redirect() throws — let it through.
        if (e && typeof e === "object" && "digest" in e) throw e;
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-1.5">
        {STEPS.map((label, i) => (
          <div key={label} className="flex-1">
            <div
              className={cn(
                "h-1.5 rounded-full",
                i <= step ? "bg-primary" : "bg-muted",
              )}
            />
            <span
              className={cn(
                "mt-1 block text-[10px]",
                i === step
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {label}
            </span>
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="program-name">Program name</Label>
            <Input
              id="program-name"
              placeholder="e.g. Front Lever Focus – Summer"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Program type</Label>
            {(Object.keys(PROGRAM_TYPE_LABELS) as ProgramType[]).map((t) => (
              <ChoiceCard
                key={t}
                title={PROGRAM_TYPE_LABELS[t]}
                description={TYPE_DESCRIPTIONS[t]}
                selected={type === t}
                onSelect={() => setType(t)}
              />
            ))}
          </div>

          {type === "split" && (
            <div className="space-y-2">
              <Label>Split style</Label>
              {(Object.keys(SPLIT_TYPE_LABELS) as SplitType[]).map((s) => (
                <ChoiceCard
                  key={s}
                  title={SPLIT_TYPE_LABELS[s]}
                  selected={splitType === s}
                  onSelect={() => setSplitType(s)}
                />
              ))}
            </div>
          )}

          {type === "sport_mix" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sport-name">Your sport</Label>
                <Input
                  id="sport-name"
                  placeholder="e.g. Bouldering, BJJ, Football"
                  value={sportName}
                  onChange={(e) => setSportName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Sport days</Label>
                <WeekdayPicker value={sportDays} onChange={setSportDays} />
              </div>
            </div>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-5">
          <div>
            <h2 className="font-semibold">Your goals</h2>
            <p className="text-sm text-muted-foreground">
              Up to 2 goals per area — one goal in total is enough. You&apos;ll
              see them on your dashboard and tick them off as you get there.
            </p>
          </div>
          {GOAL_AREAS.map((area) => (
            <div key={area} className="space-y-2">
              <Label>{GOAL_AREA_LABELS[area]}</Label>
              {goals[area].map((g, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    aria-label={`${GOAL_AREA_LABELS[area]} goal ${i + 1}`}
                    placeholder={GOAL_PLACEHOLDERS[area]}
                    value={g}
                    onChange={(e) => setGoal(area, i, e.target.value)}
                  />
                  {i === 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remove second goal"
                      onClick={() =>
                        setGoals((gs) => ({
                          ...gs,
                          [area]: gs[area].slice(0, 1),
                        }))
                      }
                    >
                      <X className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
              {goals[area].length < 2 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setGoals((gs) => ({ ...gs, [area]: [...gs[area], ""] }))
                  }
                >
                  <Plus className="size-4" /> Add a second goal
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <div>
            <h2 className="font-semibold">Periodization</h2>
            <p className="text-sm text-muted-foreground">
              Choose how intensity varies across your training days. Read the
              descriptions — pick what fits your recovery and experience.
            </p>
          </div>
          {(Object.keys(PERIODIZATION_LABELS) as Periodization[]).map((p) => (
            <ChoiceCard
              key={p}
              title={PERIODIZATION_LABELS[p]}
              description={PERIODIZATION_DESCRIPTIONS[p]}
              selected={periodization === p}
              onSelect={() => setPeriodization(p)}
            />
          ))}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Training days</Label>
            <WeekdayPicker
              value={trainingDays}
              onChange={setTrainingDays}
              disabledDays={type === "sport_mix" ? sportDays : []}
              disabledHint={
                type === "sport_mix"
                  ? `Greyed-out days are ${sportName || "sport"} days.`
                  : undefined
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Mesocycle length</Label>
            <div className="grid grid-cols-3 gap-2">
              {Array.from(
                { length: MAX_WEEKS - MIN_WEEKS + 1 },
                (_, i) => MIN_WEEKS + i,
              ).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setWeeks(w)}
                  aria-pressed={weeks === w}
                  className={cn(
                    "rounded-lg border py-3 text-sm font-medium transition-colors",
                    weeks === w
                      ? "border-primary bg-primary text-primary-foreground"
                      : "hover:border-foreground/30",
                  )}
                >
                  {w} weeks
                </button>
              ))}
            </div>
          </div>

          <Alert>
            <AlertTitle>Deload week</AlertTitle>
            <AlertDescription>
              Week {weeks} is your deload: same movements, roughly half the
              volume, so you recover and come back stronger. Don&apos;t skip it.
            </AlertDescription>
          </Alert>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2">
        {step > 0 && (
          <Button
            variant="outline"
            className="flex-1"
            disabled={pending}
            onClick={() => setStep((s) => s - 1)}
          >
            <ArrowLeft className="size-4" /> Back
          </Button>
        )}
        {step < STEPS.length - 1 ? (
          <Button
            className="flex-1"
            disabled={!stepValid}
            onClick={() => setStep((s) => s + 1)}
          >
            Next <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button className="flex-1" disabled={!stepValid || pending} onClick={finish}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                Design workouts <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
