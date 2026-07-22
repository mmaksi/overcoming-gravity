"use client";

import {
  CheckCircle2,
  History,
  Info,
  Play,
  Settings2,
  Trophy,
} from "lucide-react";
import {
  GROUP_TYPE_COLORS,
  GROUP_TYPE_LABELS,
  Measurement,
  MEASUREMENT_UNIT,
  TECHNIQUES_BY_ID,
} from "@/lib/domain/types";
import {
  Exercise,
  ExerciseGroup,
  groupConfigSummary,
  measurementOf,
  VolumeStats,
  WorkoutDay,
  WorkoutExercise,
} from "@/lib/domain/schemas";
import { statsKey } from "@/lib/domain/volume";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ExerciseSessionSheet } from "./exercise-session-sheet";
import { SetRow } from "./set-row";
import {
  isConfigurableMode,
  ModeSettings,
  modeSettingsSummary,
} from "./mode-settings-dialog";
import type { EntryState, RawPart, RawSet } from "./logging-types";
import { cn } from "@/lib/utils";

/** Short unit shown next to a set input: "sec" | "min" | "cluster reps" | "reps". */
function unitOf(exercise: Exercise, measurement: Measurement): string {
  if (measurement === "seconds") return "sec";
  if (measurement === "minutes") return "min";
  if (exercise.repStyle === "cluster") return "cluster reps";
  return "reps";
}

/** "3 sets · 8/8/6 reps @ 20/20/20kg" — the previous session's line. */
function volumeLabel(
  sets: { reps: number | null; weight?: number }[],
  measurement: Measurement,
): string {
  const values = sets.map((s) => s.reps ?? "—").join("/");
  const unit = measurement === "reps" ? " reps" : MEASUREMENT_UNIT[measurement];
  const weighted = sets.filter((s) => s.weight !== undefined);
  const weight =
    weighted.length > 0
      ? ` @ ${weighted.map((s) => s.weight).join("/")}kg`
      : "";
  return `${sets.length} sets · ${values}${unit}${weight}`;
}

/**
 * One planned exercise while logging: an optional group-mode banner (badge,
 * summary, settings gear, runner Start), the card with its title/progression
 * header, past-best hints, the editable set rows, notes, and the detail sheet.
 * All derived state is computed from the plan + the athlete's current entry.
 */
export function ExerciseCard({
  we,
  prev,
  entry,
  ex,
  stats,
  plannedDay,
  readOnly,
  sheetOpen,
  settingsOf,
  updateEntry,
  updateSet,
  updateSetParts,
  toggleSetDone,
  cycleUnit,
  placeholderFor,
  onOpenSettings,
  onStartRunner,
  onSheetOpenChange,
  onSheetChange,
}: {
  we: WorkoutExercise;
  prev: WorkoutExercise | undefined;
  entry: EntryState;
  ex: Exercise;
  stats: Record<string, VolumeStats>;
  plannedDay: WorkoutDay;
  readOnly: boolean;
  sheetOpen: boolean;
  settingsOf: (group: ExerciseGroup) => ModeSettings;
  updateEntry: (
    workoutExerciseId: string,
    updater: (e: EntryState) => EntryState,
  ) => void;
  updateSet: (
    workoutExerciseId: string,
    setIndex: number,
    patch: Partial<RawSet>,
  ) => void;
  updateSetParts: (
    workoutExerciseId: string,
    setIndex: number,
    updater: (parts: RawPart[]) => RawPart[],
  ) => void;
  toggleSetDone: (we: WorkoutExercise, setIndex: number, done: boolean) => void;
  cycleUnit: (workoutExerciseId: string, current: Measurement) => void;
  placeholderFor: (
    entry: EntryState,
    we: WorkoutExercise,
    i: number,
  ) => number;
  onOpenSettings: (groupId: string) => void;
  onStartRunner: (groupId: string) => void;
  onSheetOpenChange: (open: boolean) => void;
  onSheetChange: (
    workoutExerciseId: string,
    patch: {
      progressionId?: string;
      interTechniqueId?: string | null;
      notes?: string;
    },
  ) => void;
}) {
  const progression = ex.progressions.find((p) => p.id === entry.progressionId);
  const key = statsKey(entry.exerciseId, entry.progressionId);
  const last = stats[key]?.last;
  const max = stats[key]?.maxReps;
  const swapped = entry.progressionId !== we.progressionId;
  const technique = entry.interTechniqueId
    ? TECHNIQUES_BY_ID.get(entry.interTechniqueId)
    : undefined;
  const isHybrid = technique?.kind === "hybrid";
  const isHybridEcc = technique?.kind === "hybrid_eccentric";
  const group = we.groupId
    ? (plannedDay.groups ?? []).find((g) => g.id === we.groupId)
    : undefined;
  const isGroupStart = group && (!prev || prev.groupId !== we.groupId);
  const measurement = measurementOf(
    ex,
    entry.progressionId,
    entry.measurement ?? we.measurement,
  );
  const unit = unitOf(ex, measurement);
  const allDone = entry.sets.length > 0 && entry.sets.every((s) => s.done);

  return (
    <div>
      {isGroupStart && group && (
        <div className="mb-1.5 flex items-center gap-1.5">
          <span
            className={cn(
              "inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold",
              GROUP_TYPE_COLORS[group.type].badge,
            )}
          >
            {GROUP_TYPE_LABELS[group.type]}
          </span>
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {isConfigurableMode(group.type)
              ? modeSettingsSummary(group.type, settingsOf(group))
              : groupConfigSummary(group)}
          </span>
          {!readOnly && isConfigurableMode(group.type) && (
            <button
              type="button"
              aria-label={`${GROUP_TYPE_LABELS[group.type]} settings`}
              title="Mode settings"
              onClick={() => onOpenSettings(group.id)}
              className="shrink-0 p-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              <Settings2 className="size-4" />
            </button>
          )}
          {!readOnly &&
            (group.type === "pyramid" ||
              group.type === "ladder" ||
              group.type === "hiit" ||
              group.type === "tabata" ||
              group.type === "circuit") && (
              <Button
                size="sm"
                className="h-7 shrink-0 rounded-full px-3"
                onClick={() => onStartRunner(group.id)}
              >
                <Play className="size-3.5" /> Start
              </Button>
            )}
        </div>
      )}
      <Card
        className={cn(
          "gap-3 py-4 transition-opacity",
          group && `border-l-4 ${GROUP_TYPE_COLORS[group.type].border}`,
          allDone && "opacity-70",
        )}
      >
        <CardHeader className="px-4">
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              className="min-w-0 text-left"
              onClick={() => onSheetOpenChange(true)}
            >
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="truncate text-primary">{ex.title}</span>
                <Info className="size-4 shrink-0 text-muted-foreground" />
              </CardTitle>
              <CardDescription className="mt-1">
                <span
                  className={cn(
                    "font-medium text-sky-600 dark:text-sky-400",
                    swapped && "text-primary",
                  )}
                >
                  {progression?.name}
                  {swapped && " (swapped)"}
                </span>{" "}
                {we.tempo ? ` · tempo ${we.tempo}` : ""} · rest {we.restSeconds}s
                {ex.repStyle === "cluster" &&
                  ` · ${we.clusterRestSeconds ?? 15}s between cluster reps`}
                {technique ? ` · ${technique.name}` : ""}
              </CardDescription>
            </button>
            <CheckCircle2
              aria-label={allDone ? "Exercise done" : undefined}
              className={cn(
                "size-6 shrink-0",
                allDone ? "text-primary" : "text-muted-foreground/30",
              )}
            />
          </div>
          <div className="space-y-0.5">
            {last && (
              <p className="flex items-center gap-1 text-xs text-primary">
                <History className="size-3" />
                Last time ({last.date}):{" "}
                {volumeLabel(last.performedSets, measurement)}
              </p>
            )}
            {max != null && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Trophy className="size-3" />
                Best single set: {max}
                {measurement === "reps" ? " reps" : MEASUREMENT_UNIT[measurement]}
              </p>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2.5 px-4">
          {entry.sets.map((s, j) => (
            <SetRow
              key={j}
              set={s}
              index={j}
              setCount={entry.sets.length}
              placeholder={placeholderFor(entry, we, j)}
              isToFailureGroup={group?.type === "to_failure"}
              measurement={measurement}
              unit={unit}
              isHybrid={isHybrid}
              isHybridEcc={isHybridEcc}
              readOnly={readOnly}
              ex={ex}
              we={we}
              toggleSetDone={toggleSetDone}
              updateSet={updateSet}
              updateSetParts={updateSetParts}
              cycleUnit={cycleUnit}
            />
          ))}
          {!readOnly && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  updateEntry(we.id, (en) => ({
                    ...en,
                    sets: [
                      ...en.sets,
                      {
                        reps: "",
                        weight: "",
                        done: false,
                        parts: [{ progressionId: en.progressionId, reps: "" }],
                        eccentricReps: "",
                      },
                    ],
                  }))
                }
              >
                + set
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={entry.sets.length <= 1}
                onClick={() =>
                  updateEntry(we.id, (en) => ({
                    ...en,
                    sets: en.sets.slice(0, -1),
                  }))
                }
              >
                − set
              </Button>
            </div>
          )}
          {/* Notes are always available and remembered per progression, so
              they resurface every time you train that progression. */}
          <Textarea
            placeholder={
              technique?.prompt ??
              (we.progressionMethod === "inter"
                ? "Manual progression notes (inter-exercise progression)…"
                : "Notes for this exercise (remembered next time)…")
            }
            disabled={readOnly}
            value={entry.notes ?? ""}
            onChange={(e) =>
              updateEntry(we.id, (en) => ({ ...en, notes: e.target.value }))
            }
          />
        </CardContent>
      </Card>

      <ExerciseSessionSheet
        open={sheetOpen}
        onOpenChange={onSheetOpenChange}
        exercise={ex}
        planned={we}
        progressionId={entry.progressionId}
        interTechniqueId={entry.interTechniqueId}
        notes={entry.notes}
        stats={stats}
        readOnly={readOnly}
        onChange={(patch) => onSheetChange(we.id, patch)}
      />
    </div>
  );
}
