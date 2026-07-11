"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  CheckCircle2,
  History,
  Info,
  Loader2,
  Plus,
  SkipForward,
  Trophy,
  X,
} from "lucide-react";
import {
  Attribute,
  ATTRIBUTE_LABELS,
  ATTRIBUTE_ORDER,
  GROUP_TYPE_COLORS,
  GROUP_TYPE_LABELS,
  TECHNIQUES_BY_ID,
  WEEKDAY_LABELS,
} from "@/lib/domain/types";
import {
  Exercise,
  exerciseNoteKey,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ExerciseSessionSheet } from "./exercise-session-sheet";
import { RestTimer, RestTimerState } from "./rest-timer";
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

/** One progression-slice of a hybrid set. */
type RawPart = { progressionId: string; reps: string };

/** Editable raw inputs: empty string = "not recorded yet". */
type RawSet = {
  reps: string;
  weight: string;
  /** Marked finished by the athlete — starts the rest timer. */
  done: boolean;
  /** Hybrid sets: reps per progression inside this one set. */
  parts: RawPart[];
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
  userNotes = {},
}: {
  session: WorkoutSession;
  program: Program;
  plannedDay: WorkoutDay;
  isDeload: boolean;
  exercises: Exercise[];
  stats: Record<string, VolumeStats>;
  /** Remembered notes keyed `${exerciseId}:${techniqueId}`. */
  userNotes?: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<
    "save" | "complete" | "skip" | null
  >(null);
  const [openSheetFor, setOpenSheetFor] = useState<string | null>(null);
  const [timer, setTimer] = useState<RestTimerState | null>(null);
  const readOnly = session.status !== "planned";

  const exercisesById = useMemo(
    () => new Map(exercises.map((e) => [e.id, e])),
    [exercises],
  );

  // Exercises in designed order: warm-up → skill → strength → … → cool-down,
  // one visually separated block per section.
  const sections = useMemo(() => {
    const attributeOf = (we: WorkoutExercise): Attribute =>
      exercisesById.get(we.exerciseId)?.attribute ?? "strength";
    return ATTRIBUTE_ORDER.map((attribute) => ({
      attribute,
      exercises: plannedDay.exercises.filter(
        (we) => attributeOf(we) === attribute,
      ),
    })).filter((s) => s.exercises.length > 0);
  }, [plannedDay.exercises, exercisesById]);
  const orderedExercises = useMemo(
    () => sections.flatMap((s) => s.exercises),
    [sections],
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
            done: s.reps !== null,
            parts: s.parts
              ? s.parts.map((p) => ({
                  progressionId: p.progressionId,
                  reps: String(p.reps),
                }))
              : [
                  {
                    progressionId: s.progressionId ?? existing.progressionId,
                    reps: s.reps === null ? "" : String(s.reps),
                  },
                ],
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
          done: false,
          parts: [{ progressionId: we.progressionId, reps: "" }],
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

  /** Label for what follows once the rest after set `i` is over. */
  function nextUpLabel(we: WorkoutExercise, entry: EntryState, i: number) {
    const nextSet = entry.sets.findIndex((s, j) => j !== i && !s.done);
    const ex = exercisesById.get(entry.exerciseId);
    if (nextSet !== -1) return `Set ${nextSet + 1} · ${ex?.title ?? ""}`;
    const idx = orderedExercises.findIndex((x) => x.id === we.id);
    const after = orderedExercises[idx + 1];
    if (after) {
      const afterEx = exercisesById.get(after.exerciseId);
      return `Next exercise: ${afterEx?.title ?? ""}`;
    }
    return "Last exercise done — finish the workout!";
  }

  /** Tick a set: fill an empty input with its suggestion, start the rest. */
  function toggleSetDone(we: WorkoutExercise, setIndex: number, done: boolean) {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => undefined);
    }
    const entry = entries.find((e) => e.workoutExerciseId === we.id);
    if (!entry) return;
    updateEntry(we.id, (en) => ({
      ...en,
      sets: en.sets.map((s, j) =>
        j === setIndex
          ? {
              ...s,
              done,
              reps:
                done && s.reps === ""
                  ? String(placeholderFor(en, we, setIndex))
                  : s.reps,
            }
          : s,
      ),
    }));
    if (done) {
      const nextLabel = nextUpLabel(we, entry, setIndex);
      setTimer((prev) => ({
        id: (prev?.id ?? 0) + 1,
        seconds: we.restSeconds,
        nextLabel,
      }));
    }
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
        performedSets: entry.sets.map((s, i) => {
          if (kind === "hybrid") {
            // One set can mix several progressions; reps holds the total.
            const touched = s.parts.some((p) => p.reps !== "");
            if (!touched && action === "save") {
              return { reps: null };
            }
            const parts = s.parts
              .map((p) => ({
                progressionId: p.progressionId,
                reps: Math.max(0, Number(p.reps) || 0),
              }))
              .filter((p) => p.reps > 0);
            return {
              reps: parts.reduce((n, p) => n + p.reps, 0),
              weight:
                s.weight === "" ? undefined : Math.max(0, Number(s.weight)),
              parts: parts.length > 0 ? parts : undefined,
            };
          }
          return {
            reps:
              s.reps === ""
                ? action === "complete"
                  ? placeholderFor(entry, we, i)
                  : null
                : Math.max(0, Number(s.reps) || 0),
            weight: s.weight === "" ? undefined : Math.max(0, Number(s.weight)),
            eccentricReps:
              kind === "hybrid_eccentric" && s.eccentricReps !== ""
                ? Math.max(0, Number(s.eccentricReps) || 0)
                : undefined,
          };
        }),
      };
    });
  }

  function submit(action: "save" | "complete" | "skip") {
    setPendingAction(action);
    setTimer(null);
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
    <div className="space-y-5">
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

      {sections.map(({ attribute, exercises: sectionExercises }) => (
        <section key={attribute} className="space-y-3 pt-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {ATTRIBUTE_LABELS[attribute]}
          </h2>
          {sectionExercises.map((we, i) => {
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
            const prev = sectionExercises[i - 1];
            const group = we.groupId
              ? (plannedDay.groups ?? []).find((g) => g.id === we.groupId)
              : undefined;
            const isGroupStart = group && (!prev || prev.groupId !== we.groupId);
            const unit = unitOf(ex);
            const allDone =
              entry.sets.length > 0 && entry.sets.every((s) => s.done);

            return (
              <div key={we.id}>
                {isGroupStart && group && (
                  <span
                    className={cn(
                      "mb-1.5 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold",
                      GROUP_TYPE_COLORS[group.type].badge,
                    )}
                  >
                    {GROUP_TYPE_LABELS[group.type]}
                  </span>
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
                        onClick={() => setOpenSheetFor(we.id)}
                      >
                        <CardTitle className="flex items-center gap-2 text-base">
                          <span className="truncate">{ex.title}</span>
                          <Info className="size-4 shrink-0 text-muted-foreground" />
                        </CardTitle>
                        <CardDescription className="mt-1">
                          <span className={cn(swapped && "font-medium text-primary")}>
                            {progression?.name}
                            {swapped && " (swapped)"}
                          </span>{" "}
                          · target {volumeLabel(we.sets, ex)}
                          {we.tempo ? ` · tempo ${we.tempo}` : ""} · rest{" "}
                          {we.restSeconds}s
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
                  <CardContent className="space-y-2.5 px-4">
                    {entry.sets.map((s, j) => (
                      <div key={j} className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            aria-label={`Mark set ${j + 1} done`}
                            className="size-6 shrink-0 accent-primary"
                            disabled={readOnly}
                            checked={s.done}
                            onChange={(e) =>
                              toggleSetDone(we, j, e.target.checked)
                            }
                          />
                          <span className="w-9 shrink-0 text-xs text-muted-foreground">
                            Set {j + 1}
                          </span>
                          {!isHybrid && (
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
                          )}
                          {!isHybrid && (
                            <span className="w-12 shrink-0 text-xs text-muted-foreground">
                              {isHybridEcc ? "dyn." : unit}
                            </span>
                          )}
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
                            !isHybrid && (
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
                                        k === j
                                          ? { ...x, weight: e.target.value }
                                          : x,
                                      ),
                                    }))
                                  }
                                />
                                <span className="shrink-0 text-xs text-muted-foreground">
                                  kg
                                </span>
                              </>
                            )
                          )}
                        </div>

                        {/* Hybrid sets: any number of reps across several
                            progressions inside this one set. */}
                        {isHybrid && (
                          <div className="space-y-1.5 pl-8">
                            {s.parts.map((part, pi) => (
                              <div key={pi} className="flex items-center gap-2">
                                <Select
                                  value={part.progressionId}
                                  disabled={readOnly}
                                  onValueChange={(progressionId) =>
                                    updateEntry(we.id, (en) => ({
                                      ...en,
                                      sets: en.sets.map((x, k) =>
                                        k === j
                                          ? {
                                              ...x,
                                              parts: x.parts.map((p, q) =>
                                                q === pi
                                                  ? { ...p, progressionId }
                                                  : p,
                                              ),
                                            }
                                          : x,
                                      ),
                                    }))
                                  }
                                >
                                  <SelectTrigger className="min-w-0 flex-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {ex.progressions.map((p) => (
                                      <SelectItem key={p.id} value={p.id}>
                                        {p.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Input
                                  type="number"
                                  min={0}
                                  inputMode="numeric"
                                  placeholder="0"
                                  disabled={readOnly}
                                  className="w-20 shrink-0"
                                  value={part.reps}
                                  onChange={(e) =>
                                    updateEntry(we.id, (en) => ({
                                      ...en,
                                      sets: en.sets.map((x, k) =>
                                        k === j
                                          ? {
                                              ...x,
                                              parts: x.parts.map((p, q) =>
                                                q === pi
                                                  ? { ...p, reps: e.target.value }
                                                  : p,
                                              ),
                                            }
                                          : x,
                                      ),
                                    }))
                                  }
                                />
                                {s.parts.length > 1 && !readOnly && (
                                  <button
                                    type="button"
                                    aria-label="Remove progression from set"
                                    className="p-1 text-muted-foreground hover:text-foreground"
                                    onClick={() =>
                                      updateEntry(we.id, (en) => ({
                                        ...en,
                                        sets: en.sets.map((x, k) =>
                                          k === j
                                            ? {
                                                ...x,
                                                parts: x.parts.filter(
                                                  (_, q) => q !== pi,
                                                ),
                                              }
                                            : x,
                                        ),
                                      }))
                                    }
                                  >
                                    <X className="size-4" />
                                  </button>
                                )}
                              </div>
                            ))}
                            {!readOnly && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  updateEntry(we.id, (en) => ({
                                    ...en,
                                    sets: en.sets.map((x, k) =>
                                      k === j
                                        ? {
                                            ...x,
                                            parts: [
                                              ...x.parts,
                                              {
                                                progressionId:
                                                  ex.progressions[0].id,
                                                reps: "",
                                              },
                                            ],
                                          }
                                        : x,
                                    ),
                                  }))
                                }
                              >
                                <Plus className="size-4" /> Progression in this set
                              </Button>
                            )}
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
                                  done: false,
                                  parts: [
                                    {
                                      progressionId: en.progressionId,
                                      reps: "",
                                    },
                                  ],
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
                      }),
                      ...(patch.notes !== undefined && { notes: patch.notes }),
                      ...(patch.interTechniqueId !== undefined && {
                        interTechniqueId: patch.interTechniqueId ?? undefined,
                        // Prefill the remembered note for this exercise +
                        // technique pair (never overwrite what's typed).
                        ...(patch.interTechniqueId &&
                          !en.notes?.trim() && {
                            notes:
                              userNotes[
                                exerciseNoteKey(
                                  en.exerciseId,
                                  patch.interTechniqueId,
                                )
                              ],
                          }),
                      }),
                    }))
                  }
                />
              </div>
            );
          })}
        </section>
      ))}

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

      {timer && !readOnly && (
        <RestTimer
          key={timer.id}
          seconds={timer.seconds}
          nextLabel={timer.nextLabel}
          onDismiss={() => setTimer(null)}
        />
      )}
    </div>
  );
}
