"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  History,
  Info,
  Loader2,
  SkipForward,
  Trophy,
} from "lucide-react";
import {
  ATTRIBUTE_LABELS,
  GROUP_TYPE_LABELS,
  TECHNIQUES_BY_ID,
  WEEKDAY_LABELS,
} from "@/lib/domain/types";
import {
  Exercise,
  Program,
  SessionEntry,
  VolumeStats,
  WorkoutDay,
  WorkoutExercise,
  WorkoutSession,
} from "@/lib/domain/schemas";
import { statsKey } from "@/lib/domain/volume";
import { saveWorkoutSession } from "@/lib/actions/runs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ExerciseSessionSheet } from "./exercise-session-sheet";
import { cn } from "@/lib/utils";

function unitOf(exercise: Exercise): string {
  if (exercise.measurement === "time") return "sec";
  if (exercise.repStyle === "cluster") return "cluster reps";
  return "reps";
}

function volumeLabel(
  sets: { reps: number | null; weight?: number }[],
  exercise: Exercise,
): string {
  const values = sets.map((s) => s.reps ?? "—").join("/");
  const unit = exercise.measurement === "time" ? "s" : " reps";
  const weighted = sets.filter((s) => s.weight !== undefined);
  const weight =
    weighted.length > 0
      ? ` @ ${weighted.map((s) => s.weight).join("/")}kg`
      : "";
  return `${sets.length} sets · ${values}${unit}${weight}`;
}

/** Editable raw inputs: empty string = "not recorded yet". */
type RawSet = {
  reps: string;
  weight: string;
  /** Hybrid sets: progression used for this specific set. */
  progressionId: string;
  /** Hybrid + eccentrics: eccentric reps after the dynamic ones. */
  eccentricReps: string;
};
type EntryState = {
  workoutExerciseId: string;
  exerciseId: string;
  progressionId: string;
  interTechniqueId?: string;
  notes?: string;
  sets: RawSet[];
};

export function WorkoutLogger({
  session,
  program,
  plannedDay,
  isDeload,
  exercises,
  stats,
}: {
  session: WorkoutSession;
  program: Program;
  plannedDay: WorkoutDay;
  isDeload: boolean;
  exercises: Exercise[];
  stats: Record<string, VolumeStats>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<
    "save" | "complete" | "skip" | null
  >(null);
  const [openSheetFor, setOpenSheetFor] = useState<string | null>(null);
  const readOnly = session.status !== "planned";

  const exercisesById = useMemo(
    () => new Map(exercises.map((e) => [e.id, e])),
    [exercises],
  );

  const [entries, setEntries] = useState<EntryState[]>(() =>
    plannedDay.exercises.map((we) => {
      const existing = session.entries.find(
        (e) => e.workoutExerciseId === we.id,
      );
      if (existing) {
        return {
          workoutExerciseId: we.id,
          exerciseId: existing.exerciseId,
          progressionId: existing.progressionId,
          interTechniqueId: existing.interTechniqueId ?? we.interTechniqueId,
          notes: existing.notes,
          sets: existing.performedSets.map((s) => ({
            reps: s.reps === null ? "" : String(s.reps),
            weight: s.weight !== undefined ? String(s.weight) : "",
            progressionId: s.progressionId ?? existing.progressionId,
            eccentricReps:
              s.eccentricReps !== undefined ? String(s.eccentricReps) : "",
          })),
        };
      }
      return {
        workoutExerciseId: we.id,
        exerciseId: we.exerciseId,
        progressionId: we.progressionId,
        interTechniqueId: we.interTechniqueId,
        notes: we.notes,
        // Start empty: the placeholder shows your past max for this
        // progression (or the plan target). Empty stays empty on "save
        // progress" and resolves to the placeholder on "complete".
        sets: we.sets.map(() => ({
          reps: "",
          weight: "",
          progressionId: we.progressionId,
          eccentricReps: "",
        })),
      };
    }),
  );

  function updateEntry(
    workoutExerciseId: string,
    updater: (e: EntryState) => EntryState,
  ) {
    setEntries((prev) =>
      prev.map((e) =>
        e.workoutExerciseId === workoutExerciseId ? updater(e) : e,
      ),
    );
  }

  /** Placeholder for a set input: past best, else the plan target. */
  function placeholderFor(entry: EntryState, we: WorkoutExercise, i: number) {
    const max = stats[statsKey(entry.exerciseId, entry.progressionId)]?.maxReps;
    if (max != null) return max;
    return we.sets[Math.min(i, we.sets.length - 1)]?.reps ?? 8;
  }

  /**
   * "save" keeps untouched inputs as null (still empty when you come back);
   * "complete" resolves them to the suggested placeholder values.
   */
  function resolveEntries(action: "save" | "complete"): SessionEntry[] {
    return entries.map((entry) => {
      const we = plannedDay.exercises.find(
        (w) => w.id === entry.workoutExerciseId,
      )!;
      const kind = entry.interTechniqueId
        ? TECHNIQUES_BY_ID.get(entry.interTechniqueId)?.kind
        : undefined;
      return {
        workoutExerciseId: entry.workoutExerciseId,
        exerciseId: entry.exerciseId,
        progressionId: entry.progressionId,
        interTechniqueId: entry.interTechniqueId,
        notes: entry.notes || undefined,
        performedSets: entry.sets.map((s, i) => ({
          reps:
            s.reps === ""
              ? action === "complete"
                ? placeholderFor(entry, we, i)
                : null
              : Math.max(0, Number(s.reps) || 0),
          weight: s.weight === "" ? undefined : Math.max(0, Number(s.weight)),
          progressionId:
            kind === "hybrid" && s.progressionId !== entry.progressionId
              ? s.progressionId
              : undefined,
          eccentricReps:
            kind === "hybrid_eccentric" && s.eccentricReps !== ""
              ? Math.max(0, Number(s.eccentricReps) || 0)
              : undefined,
        })),
      };
    });
  }

  function submit(action: "save" | "complete" | "skip") {
    setPendingAction(action);
    startTransition(async () => {
      try {
        const result = await saveWorkoutSession({
          sessionId: session.id,
          entries: action === "skip" ? [] : resolveEntries(action),
          action,
        });
        if (action === "save") {
          setPendingAction(null);
          return;
        }
        if (result.runCompleted && result.programId) {
          router.push(`/programs/${result.programId}`);
        } else {
          router.push("/");
        }
      } catch {
        setPendingAction(null);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">{program.name}</h1>
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {WEEKDAY_LABELS[session.weekday]} {session.date} · week{" "}
          {session.weekIndex + 1}
          {plannedDay.intensity && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                plannedDay.intensity === "high"
                  ? "bg-orange-500/15 text-orange-600"
                  : "bg-sky-500/15 text-sky-600",
              )}
            >
              {plannedDay.intensity} volume
            </span>
          )}
          {session.status !== "planned" && (
            <Badge variant="secondary">{session.status}</Badge>
          )}
        </p>
      </div>

      {isDeload && (
        <Alert>
          <AlertTitle>Deload week</AlertTitle>
          <AlertDescription>
            Go easy on purpose: about half your usual sets or reps. You&apos;re
            banking recovery, not losing progress.
          </AlertDescription>
        </Alert>
      )}

      {plannedDay.exercises.map((we, i) => {
        const entry = entries.find((e) => e.workoutExerciseId === we.id);
        if (!entry) return null;
        const ex = exercisesById.get(entry.exerciseId);
        if (!ex) return null;
        const progression = ex.progressions.find(
          (p) => p.id === entry.progressionId,
        );
        const key = statsKey(entry.exerciseId, entry.progressionId);
        const last = stats[key]?.last;
        const max = stats[key]?.maxReps;
        const swapped = entry.progressionId !== we.progressionId;
        const technique = entry.interTechniqueId
          ? TECHNIQUES_BY_ID.get(entry.interTechniqueId)
          : undefined;
        const isHybrid = technique?.kind === "hybrid";
        const isHybridEcc = technique?.kind === "hybrid_eccentric";
        const prev = plannedDay.exercises[i - 1];
        const group = we.groupId
          ? (plannedDay.groups ?? []).find((g) => g.id === we.groupId)
          : undefined;
        const isGroupStart = group && (!prev || prev.groupId !== we.groupId);
        const unit = unitOf(ex);

        return (
          <div key={we.id}>
            {isGroupStart && group && (
              <Badge variant="secondary" className="mb-1 text-[10px]">
                {GROUP_TYPE_LABELS[group.type]} — alternate these exercises
              </Badge>
            )}
            <Card
              className={cn(
                "gap-3 py-4",
                group && "border-l-4 border-l-violet-500",
              )}
            >
              <CardHeader className="px-4">
                <button
                  type="button"
                  className="text-left"
                  onClick={() => setOpenSheetFor(we.id)}
                >
                  <CardTitle className="flex items-center gap-2 text-base">
                    {ex.title}
                    <Badge variant="secondary" className="text-[10px]">
                      {ATTRIBUTE_LABELS[ex.attribute]}
                    </Badge>
                    <Info className="size-4 text-muted-foreground" />
                  </CardTitle>
                  <CardDescription className="mt-1">
                    <span className={cn(swapped && "font-medium text-primary")}>
                      {progression?.name}
                      {swapped && " (swapped)"}
                    </span>{" "}
                    · target {volumeLabel(we.sets, ex)} · rest {we.restSeconds}s
                    {ex.repStyle === "cluster" &&
                      ` · ${we.clusterRestSeconds ?? 15}s between cluster reps`}
                    {technique ? ` · ${technique.name}` : ""}
                  </CardDescription>
                </button>
                <div className="space-y-0.5">
                  {last && (
                    <p className="flex items-center gap-1 text-xs text-primary">
                      <History className="size-3" />
                      Last time ({last.date}): {volumeLabel(last.performedSets, ex)}
                    </p>
                  )}
                  {max != null && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Trophy className="size-3" />
                      Best single set: {max}
                      {ex.measurement === "time" ? "s" : " reps"}
                    </p>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2 px-4">
                {entry.sets.map((s, j) => (
                  <div key={j} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-10 shrink-0 text-xs text-muted-foreground">
                        Set {j + 1}
                      </span>
                      <Input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        disabled={readOnly}
                        placeholder={String(placeholderFor(entry, we, j))}
                        value={s.reps}
                        onChange={(e) =>
                          updateEntry(we.id, (en) => ({
                            ...en,
                            sets: en.sets.map((x, k) =>
                              k === j ? { ...x, reps: e.target.value } : x,
                            ),
                          }))
                        }
                      />
                      <span className="w-14 shrink-0 text-xs text-muted-foreground">
                        {isHybridEcc ? "dynamic" : unit}
                      </span>
                      {isHybridEcc ? (
                        <>
                          <Input
                            type="number"
                            min={0}
                            inputMode="numeric"
                            placeholder="0"
                            disabled={readOnly}
                            value={s.eccentricReps}
                            onChange={(e) =>
                              updateEntry(we.id, (en) => ({
                                ...en,
                                sets: en.sets.map((x, k) =>
                                  k === j
                                    ? { ...x, eccentricReps: e.target.value }
                                    : x,
                                ),
                              }))
                            }
                          />
                          <span className="shrink-0 text-xs text-muted-foreground">
                            ecc.
                          </span>
                        </>
                      ) : (
                        <>
                          <Input
                            type="number"
                            min={0}
                            step={0.5}
                            inputMode="decimal"
                            placeholder="—"
                            disabled={readOnly}
                            value={s.weight}
                            onChange={(e) =>
                              updateEntry(we.id, (en) => ({
                                ...en,
                                sets: en.sets.map((x, k) =>
                                  k === j ? { ...x, weight: e.target.value } : x,
                                ),
                              }))
                            }
                          />
                          <span className="shrink-0 text-xs text-muted-foreground">
                            kg
                          </span>
                        </>
                      )}
                    </div>
                    {isHybrid && (
                      <div className="flex items-center gap-2 pl-12">
                        <select
                          className="w-full rounded-md border bg-transparent px-2 py-1 text-xs"
                          disabled={readOnly}
                          value={s.progressionId}
                          onChange={(e) =>
                            updateEntry(we.id, (en) => ({
                              ...en,
                              sets: en.sets.map((x, k) =>
                                k === j
                                  ? { ...x, progressionId: e.target.value }
                                  : x,
                              ),
                            }))
                          }
                        >
                          {ex.progressions.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
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
                              progressionId: en.progressionId,
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
                {(technique?.kind === "notes" ||
                  we.progressionMethod === "inter" ||
                  entry.notes) && (
                  <Textarea
                    placeholder={
                      technique?.prompt ??
                      (we.progressionMethod === "inter"
                        ? "Manual progression notes (inter-exercise progression)…"
                        : "Notes…")
                    }
                    disabled={readOnly}
                    value={entry.notes ?? ""}
                    onChange={(e) =>
                      updateEntry(we.id, (en) => ({
                        ...en,
                        notes: e.target.value,
                      }))
                    }
                  />
                )}
              </CardContent>
            </Card>

            <ExerciseSessionSheet
              open={openSheetFor === we.id}
              onOpenChange={(o) => setOpenSheetFor(o ? we.id : null)}
              exercise={ex}
              planned={we}
              progressionId={entry.progressionId}
              interTechniqueId={entry.interTechniqueId}
              notes={entry.notes}
              stats={stats}
              readOnly={readOnly}
              onChange={(patch) =>
                updateEntry(we.id, (en) => ({
                  ...en,
                  ...(patch.progressionId !== undefined && {
                    progressionId: patch.progressionId,
                    // keep per-set picks in sync when not doing hybrid sets
                    sets: en.sets.map((s) => ({
                      ...s,
                      progressionId: patch.progressionId!,
                    })),
                  }),
                  ...(patch.notes !== undefined && { notes: patch.notes }),
                  ...(patch.interTechniqueId !== undefined && {
                    interTechniqueId: patch.interTechniqueId ?? undefined,
                  }),
                }))
              }
            />
          </div>
        );
      })}

      {!readOnly && (
        <div className="space-y-2 pb-4">
          <Button
            className="w-full"
            size="lg"
            disabled={pending}
            onClick={() => submit("complete")}
          >
            {pending && pendingAction === "complete" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <Check className="size-4" /> Complete workout
              </>
            )}
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              disabled={pending}
              onClick={() => submit("save")}
            >
              {pending && pendingAction === "save" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Save progress"
              )}
            </Button>
            <Button
              variant="ghost"
              className="flex-1"
              disabled={pending}
              onClick={() => submit("skip")}
            >
              <SkipForward className="size-4" /> Skip
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
