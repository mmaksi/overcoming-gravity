"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  History,
  Info,
  Loader2,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Settings2,
  SkipForward,
  Timer,
  Trophy,
  X,
} from "lucide-react";
import {
  ATTRIBUTE_LABELS,
  GROUP_TYPE_COLORS,
  GROUP_TYPE_LABELS,
  INTENSITY_LABELS,
  Measurement,
  MEASUREMENT_UNIT,
  TABATA,
  TECHNIQUES_BY_ID,
  WEEK_FOCUS_LABELS,
  WeekFocus,
  WEEKDAY_LABELS,
} from "@/lib/domain/types";
import {
  convertMeasureValue,
  daySections,
  Exercise,
  exerciseNoteKey,
  groupConfigSummary,
  measurementOf,
  SessionEntry,
  VolumeStats,
  WorkoutDay,
  WorkoutExercise,
  WorkoutSession,
} from "@/lib/domain/schemas";
import { statsKey } from "@/lib/domain/volume";
import { rememberExerciseNote, saveWorkoutSession } from "@/lib/actions/runs";
import { queryKeys } from "@/lib/query/keys";
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
import { Toast, useToast } from "@/components/ui/toast";
import { ExerciseSessionSheet } from "./exercise-session-sheet";
import { RestTimer, RestTimerState } from "./rest-timer";
import { Stopwatch } from "./stopwatch";
import { ClimbRunner } from "./climb-runner";
import { IntervalRunner } from "./interval-runner";
import { CircuitRunner } from "./circuit-runner";
import {
  circuitStations,
  isConfigurableMode,
  ModeSettings,
  ModeSettingsDialog,
  modeSettingsSummary,
  seedModeSettings,
} from "./mode-settings-dialog";
import { cn } from "@/lib/utils";

/** Short unit shown next to a set input: "sec" | "min" | "cluster reps" | "reps". */
function unitOf(exercise: Exercise, measurement: Measurement): string {
  if (measurement === "seconds") return "sec";
  if (measurement === "minutes") return "min";
  if (exercise.repStyle === "cluster") return "cluster reps";
  return "reps";
}

/** The next unit in the reps → seconds → minutes cycle. */
function nextUnit(measurement: Measurement): Measurement {
  return measurement === "reps"
    ? "seconds"
    : measurement === "seconds"
      ? "minutes"
      : "reps";
}

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

/** One progression-slice of a hybrid set. */
type RawPart = { progressionId: string; reps: string };

/**
 * Digits only, plus a single decimal point when the unit allows fractions
 * (minute holds like 1.5). The athlete may also clear the field completely.
 */
function cleanNumeric(value: string, allowDecimal: boolean): string {
  return allowDecimal
    ? value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1")
    : value.replace(/\D/g, "");
}

/** Select the whole value on focus so typing replaces it immediately. */
function selectAll(e: React.FocusEvent<HTMLInputElement>) {
  e.target.select();
}

/** Best-effort message to the service worker (PWA installs). */
function postToServiceWorker(message: Record<string, unknown>) {
  try {
    navigator.serviceWorker?.controller?.postMessage(message);
  } catch {
    // No service worker in dev — the in-page rest bar still works.
  }
}

/** localStorage key for a session's in-flight rest, so it survives navigation. */
function restKey(sessionId: string) {
  return `strong-journal-rest:${sessionId}`;
}

function saveRest(sessionId: string, timer: RestTimerState) {
  try {
    localStorage.setItem(
      restKey(sessionId),
      JSON.stringify({
        seconds: timer.seconds,
        nextLabel: timer.nextLabel,
        startedAt: timer.startedAt,
      }),
    );
  } catch {
    // Private mode / storage full — the rest bar still works this session.
  }
}

function clearRest(sessionId: string) {
  try {
    localStorage.removeItem(restKey(sessionId));
  } catch {
    // ignore
  }
}

/** Restore a still-running rest for this session, or null if none/expired. */
function loadRest(sessionId: string): RestTimerState | null {
  try {
    const raw = localStorage.getItem(restKey(sessionId));
    if (!raw) return null;
    const { seconds, nextLabel, startedAt } = JSON.parse(raw);
    if (
      typeof seconds !== "number" ||
      typeof startedAt !== "number" ||
      Date.now() - startedAt >= seconds * 1000
    ) {
      localStorage.removeItem(restKey(sessionId));
      return null;
    }
    return { id: 1, seconds, nextLabel: nextLabel ?? "", startedAt };
  } catch {
    return null;
  }
}

/**
 * localStorage key for a session's workout-time mode settings (superset rest,
 * pyramid climb shape, …), so they survive leaving and returning to the page
 * without a single server write.
 */
function modesKey(sessionId: string) {
  return `strong-journal-modes:${sessionId}`;
}

function loadModeSettings(sessionId: string): Record<string, ModeSettings> {
  try {
    const raw = localStorage.getItem(modesKey(sessionId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveModeSettings(
  sessionId: string,
  settings: Record<string, ModeSettings>,
) {
  try {
    localStorage.setItem(modesKey(sessionId), JSON.stringify(settings));
  } catch {
    // Private mode / storage full — settings still hold for this visit.
  }
}

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * The header's live workout clock. A leaf component so its one-second tick
 * re-renders just this text, not the whole logger tree.
 */
function WorkoutClock({
  baseSeconds,
  openedAt,
}: {
  baseSeconds: number;
  openedAt: number;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  return formatDuration(
    baseSeconds + Math.max(0, Math.floor((now - openedAt) / 1000)),
  );
}

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
  /** The unit the athlete is logging in — switchable mid-workout. */
  measurement?: Measurement;
  sets: RawSet[];
};

export function WorkoutLogger({
  session,
  title,
  plannedDay,
  isDeload,
  weekFocus,
  exercises,
  stats,
  userNotes = {},
}: {
  session: WorkoutSession;
  /** Program name or custom workout title, shown in the sticky header. */
  title: string;
  plannedDay: WorkoutDay;
  isDeload: boolean;
  /** Accumulation & Intensification programs: this week's focus. */
  weekFocus?: WeekFocus;
  exercises: Exercise[];
  stats: Record<string, VolumeStats>;
  /** Remembered notes keyed by `exerciseNoteKey(exerciseId, progressionId)`. */
  userNotes?: Record<string, string>;
}) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<
    "save" | "complete" | "skip" | null
  >(null);
  const pending = pendingAction !== null;
  /** Last background draft save; awaited before any explicit submit. */
  const autosaveInflight = useRef<Promise<void>>(Promise.resolve());
  const [openSheetFor, setOpenSheetFor] = useState<string | null>(null);
  const [timer, setTimer] = useState<RestTimerState | null>(null);
  const [stopwatchOpen, setStopwatchOpen] = useState(false);
  // Workout-time mode settings, keyed by group id (session-local, never on
  // the plan): the gear next to a mode badge edits them, the pyramid/ladder
  // runner reads them.
  const [modeSettings, setModeSettings] = useState<
    Record<string, ModeSettings>
  >({});
  const [settingsFor, setSettingsFor] = useState<string | null>(null);
  const [runnerFor, setRunnerFor] = useState<string | null>(null);
  /** Bumped per opening so every run starts fresh (the runner is keyed). */
  const [runnerRun, setRunnerRun] = useState(0);
  const { message: toastMessage, toast } = useToast();
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  // A completed/skipped session opened from history. Its logger renders
  // read-only until the athlete taps "Edit", which unlocks the same inputs
  // used to log a live workout so past data can be corrected.
  const historical = session.status !== "planned";
  const [isEditing, setIsEditing] = useState(false);
  const readOnly = historical && !isEditing;

  // Workout duration: accumulated seconds from previous visits (frozen at
  // mount) plus the time this page has been open. Persisted on every save,
  // so backgrounding the app pauses instead of losing the timer. The ticking
  // display lives in WorkoutClock (a leaf component) so the whole logger
  // tree isn't re-rendered every second.
  const [baseSeconds, setBaseSeconds] = useState(session.durationSeconds ?? 0);
  const [openedAt, setOpenedAt] = useState(() => Date.now());

  /** Elapsed workout seconds right now — for saves (called in handlers). */
  function currentElapsedSeconds(): number {
    // Editing history must never inflate the recorded duration: the clock is
    // only live while training a planned session, frozen otherwise.
    if (readOnly || historical) return baseSeconds;
    return baseSeconds + Math.max(0, Math.floor((Date.now() - openedAt) / 1000));
  }

  /** Start the workout duration over from 0:00 (e.g. opened the page early). */
  function resetWorkoutTimer() {
    setBaseSeconds(0);
    setOpenedAt(Date.now());
  }

  const exercisesById = useMemo(
    () => new Map(exercises.map((e) => [e.id, e])),
    [exercises],
  );

  // Mount-only restore of this session's mode settings from localStorage:
  // must run post-hydration (the server can't read localStorage).
  useEffect(() => {
    const stored = loadModeSettings(session.id);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (Object.keys(stored).length > 0) setModeSettings(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (Object.keys(modeSettings).length === 0) return;
    saveModeSettings(session.id, modeSettings);
  }, [modeSettings, session.id]);

  /** A group's effective settings: mode defaults ← plan legacy ← this session. */
  function settingsOf(group: NonNullable<WorkoutDay["groups"]>[number]) {
    return { ...seedModeSettings(group), ...modeSettings[group.id] };
  }

  /**
   * A finished pyramid/ladder run lands as plain sets and reps in ONE state
   * update — the debounced autosave then persists the whole run as a single
   * request.
   */
  function recordClimb(
    we: WorkoutExercise,
    type: "pyramid" | "ladder",
    reps: number[],
  ) {
    updateEntry(we.id, (en) => ({
      ...en,
      measurement: "reps",
      sets: reps.map((r) => ({
        reps: String(r),
        weight: "",
        done: true,
        parts: [{ progressionId: en.progressionId, reps: "" }],
        eccentricReps: "",
      })),
    }));
    setRunnerFor(null);
    const total = reps.reduce((n, r) => n + r, 0);
    toast(
      `${GROUP_TYPE_LABELS[type]} recorded — ${reps.length} sets · ${total} reps`,
    );
  }

  /**
   * A finished circuit auto-fills every exercise in the group: `rounds` sets
   * each, at that station's amount and unit (reps or seconds). One state
   * update, so the debounced autosave persists the whole group at once. The
   * runner stays on its finished screen; closing it is left to the athlete.
   */
  function recordCircuit(group: NonNullable<WorkoutDay["groups"]>[number]) {
    const settings = settingsOf(group);
    const groupExercises = plannedDay.exercises.filter(
      (we) => we.groupId === group.id,
    );
    const stations = circuitStations(settings, groupExercises.length);
    const rounds = settings.rounds ?? 3;
    setEntries((prev) =>
      prev.map((en) => {
        const idx = groupExercises.findIndex(
          (we) => we.id === en.workoutExerciseId,
        );
        const station = idx === -1 ? undefined : stations[idx];
        if (!station) return en;
        return {
          ...en,
          measurement: station.mode === "seconds" ? "seconds" : "reps",
          sets: Array.from({ length: rounds }, () => ({
            reps: String(station.amount),
            weight: "",
            done: true,
            parts: [{ progressionId: en.progressionId, reps: "" }],
            eccentricReps: "",
          })),
        };
      }),
    );
    toast(`Circuit logged — ${rounds} set${rounds === 1 ? "" : "s"} per exercise`);
  }

  // Live per-progression note texts for this workout, seeded from the server's
  // remembered notes. Swapping progression mid-workout stashes the current
  // text under the progression being left and surfaces the target
  // progression's own note — notes never travel between progressions.
  const notesByProgression = useRef<Record<string, string>>({ ...userNotes });

  // Exercises in designed order: warm-up → skill → strength → … → cool-down,
  // one visually separated block per section (an exercise may be planned
  // into a section other than its own attribute). `daySections` is the same
  // canonical order the designer displays and persists.
  const sections = useMemo(
    () => daySections(plannedDay.exercises, exercisesById),
    [plannedDay.exercises, exercisesById],
  );
  const orderedExercises = useMemo(
    () => sections.flatMap((s) => s.exercises),
    [sections],
  );

  // Seed logger state from the session's saved entries (a resumed or
  // completed workout) or, for a fresh planned session, from the plan. Kept a
  // named builder so cancelling an edit can restore the untouched values.
  function buildInitialEntries(): EntryState[] {
    return plannedDay.exercises.map((we) => {
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
          measurement: existing.measurement ?? we.measurement,
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
        measurement: we.measurement,
        // The remembered note for this exact progression resurfaces; the
        // plan-level note is only a seed for progressions never noted before.
        notes:
          userNotes[exerciseNoteKey(we.exerciseId, we.progressionId)] ??
          we.notes,
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
    });
  }

  const [entries, setEntries] = useState<EntryState[]>(buildInitialEntries);

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

  /**
   * Switch how this exercise is logged today (reps → seconds → minutes),
   * converting typed set values so the physical amount is preserved across
   * seconds↔minutes. The choice is saved on the session entry.
   */
  function cycleUnit(workoutExerciseId: string, current: Measurement) {
    const to = nextUnit(current);
    updateEntry(workoutExerciseId, (en) => ({
      ...en,
      measurement: to,
      sets: en.sets.map((s) =>
        s.reps === ""
          ? s
          : { ...s, reps: String(convertMeasureValue(Number(s.reps), current, to)) },
      ),
    }));
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
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "default"
    ) {
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
    // Rest timers belong to a live workout — editing history just corrects
    // recorded sets, so ticking a box there must not start one.
    if (done && !historical) {
      const nextLabel = nextUpLabel(we, entry, setIndex);
      // Foreground rest = the in-app bar only. The service worker takes
      // over (with a notification) only if the app goes to the background
      // mid-rest — see the visibilitychange hand-off below.
      setTimer((prev) => {
        const next = {
          id: (prev?.id ?? 0) + 1,
          seconds: we.restSeconds,
          nextLabel,
          startedAt: Date.now(),
        };
        // Persist so the rest survives leaving and returning to this page.
        saveRest(session.id, next);
        return next;
      });
    }
  }

  /**
   * "save" keeps untouched inputs as null (still empty when you come back);
   * "complete" drops untouched sets entirely — only what the athlete
   * actually recorded is registered.
   */
  function resolveEntries(action: "save" | "complete"): SessionEntry[] {
    return entries.map((entry) => {
      const kind = entry.interTechniqueId
        ? TECHNIQUES_BY_ID.get(entry.interTechniqueId)?.kind
        : undefined;
      const performedSets = entry.sets
        .map((s) => {
          if (kind === "hybrid") {
            // One set can mix several progressions; reps holds the total.
            const touched = s.parts.some((p) => p.reps !== "");
            if (!touched) return action === "save" ? { reps: null } : null;
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
          if (s.reps === "") {
            return action === "save" ? { reps: null } : null;
          }
          return {
            reps: Math.max(0, Number(s.reps) || 0),
            weight: s.weight === "" ? undefined : Math.max(0, Number(s.weight)),
            eccentricReps:
              kind === "hybrid_eccentric" && s.eccentricReps !== ""
                ? Math.max(0, Number(s.eccentricReps) || 0)
                : undefined,
          };
        })
        .filter((s): s is NonNullable<typeof s> => s !== null);
      return {
        workoutExerciseId: entry.workoutExerciseId,
        exerciseId: entry.exerciseId,
        progressionId: entry.progressionId,
        interTechniqueId: entry.interTechniqueId,
        notes: entry.notes || undefined,
        measurement: entry.measurement,
        performedSets,
      };
    });
  }

  const queryClient = useQueryClient();

  // Every server write goes through TanStack Query. The explicit submit
  // invalidates the client-cached history + progress reads on complete/skip
  // (a "save" leaves the session planned, so it changes neither); the draft
  // autosave writes silently and invalidates nothing.
  const submitMutation = useMutation({
    mutationFn: (action: "save" | "complete" | "skip") =>
      saveWorkoutSession({
        sessionId: session.id,
        entries: action === "skip" ? [] : resolveEntries(action),
        action,
        durationSeconds: currentElapsedSeconds(),
      }),
    // Completing/skipping changes the cached history + progress reads. (A save
    // leaves the session planned, so it changes neither.) Navigation is done by
    // the caller after awaiting, not here: a router.push queued in the same tick
    // as the action's revalidation is swallowed in this Next fork.
    onSuccess: (_result, action) => {
      if (action === "save") return;
      queryClient.invalidateQueries({ queryKey: queryKeys.history() });
      queryClient.invalidateQueries({ queryKey: queryKeys.progress() });
    },
  });

  const autosaveMutation = useMutation({
    mutationFn: () =>
      saveWorkoutSession({
        sessionId: session.id,
        entries: resolveEntries("save"),
        action: "save",
        durationSeconds: currentElapsedSeconds(),
        // Background draft: persists data without invalidating any caches.
        draft: true,
      }),
    onMutate: () => setSaveStatus("saving"),
    onSuccess: () => setSaveStatus("saved"),
    onError: () => setSaveStatus("idle"),
  });

  // Fire-and-forget: persists the note of a progression the athlete is
  // swapping away from (the session save only carries the final progression's
  // note). Failures are silent — the note still lives in this session's state.
  const rememberNoteMutation = useMutation({
    mutationFn: (input: {
      exerciseId: string;
      progressionId: string;
      note: string;
    }) => rememberExerciseNote(input),
  });

  async function submit(action: "save" | "complete" | "skip") {
    // Synchronous guard so a double-tap during the autosave await below can't
    // fire two submits (the derived `pending` only flips once the mutation
    // starts, which is after the await).
    if (pending) return;
    setPendingAction(action);
    setTimer(null);
    clearRest(session.id);
    postToServiceWorker({ type: "rest-timer-cancel" });
    // No autosave overlap: a draft write still in flight when this one
    // navigates would swallow the navigation, so cancel and await it first.
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    await autosaveInflight.current;
    try {
      const result = await submitMutation.mutateAsync(action);
      if (action === "save") {
        setPendingAction(null);
        return;
      }
      // Navigate here, after the await, so the push isn't swallowed by the
      // action's revalidation; this component then unmounts.
      if (result.runCompleted && result.programId) {
        // The whole program just finished — its page is the bigger celebration.
        router.push(`/programs/${result.programId}`);
      } else if (action === "complete") {
        router.push(`/workout/${session.id}/congrats`);
      } else {
        router.push("/");
      }
    } catch {
      setPendingAction(null);
    }
  }

  /**
   * Persist edits to a completed workout, keeping it completed. Reuses the
   * "complete" action so the history + progress caches refresh (the run is
   * already finished, so this never re-triggers completion navigation). Stays
   * on the page and drops back to the read-only view on success.
   */
  async function saveEdits() {
    if (pending) return;
    setPendingAction("complete");
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    try {
      await submitMutation.mutateAsync("complete");
      // Drop fully-empty sets (the save discarded them too) so the read-only
      // view matches exactly what was persisted.
      setEntries((prev) =>
        prev.map((en) => ({
          ...en,
          sets: en.sets.filter(
            (s) =>
              s.reps !== "" ||
              s.eccentricReps !== "" ||
              s.parts.some((p) => p.reps !== ""),
          ),
        })),
      );
      setIsEditing(false);
      setPendingAction(null);
      toast("Workout updated");
    } catch {
      setPendingAction(null);
    }
  }

  /** Discard in-progress edits and restore the workout's saved values. */
  function cancelEdit() {
    if (pending) return;
    setEntries(buildInitialEntries());
    setIsEditing(false);
  }

  // Autosave the draft so backgrounding the app never loses recorded values:
  // debounced after every change, flushed immediately when the app hides.
  const autosaveRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    autosaveRef.current = () => {
      // No background autosave when editing history — the athlete saves those
      // corrections explicitly, and the draft path would fight the frozen
      // duration and completed status.
      if (readOnly || pending || historical) return;
      // Keep the in-flight promise so an explicit submit can await it before
      // navigating (see submit()). mutateAsync rejects on error; both outcomes
      // settle to void here so that await never throws. Status is driven by the
      // mutation's onMutate/onSuccess/onError callbacks.
      autosaveInflight.current = autosaveMutation.mutateAsync().then(
        () => undefined,
        () => undefined,
      );
    };
  });
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  useEffect(() => {
    if (!dirtyRef.current) {
      dirtyRef.current = true; // skip the initial render
      return;
    }
    if (readOnly) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => autosaveRef.current(), 2500);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
    // openedAt changes only on a timer reset — autosave persists the reset.
  }, [entries, openedAt, readOnly]);
  useEffect(() => {
    function onHide() {
      if (document.visibilityState === "hidden") {
        if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
        autosaveRef.current();
      }
    }
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
    };
  }, []);

  // Rest-timer hand-off: while the app is visible the in-app bar is the only
  // rest UI (no notifications). Going to the background mid-rest hands the
  // remaining seconds to the service worker, which notifies when rest ends;
  // coming back cancels the SW side so nothing fires twice.
  const timerRef = useRef<RestTimerState | null>(null);
  useEffect(() => {
    timerRef.current = timer;
  }, [timer]);
  // Restore a rest that was still running when the page was left (the timer
  // lives in localStorage keyed by session, so navigating away and back — or
  // the mobile browser discarding the page — resumes from the right second).
  useEffect(() => {
    // Mount-only restore from localStorage: must run post-hydration (the
    // server can't read localStorage), so setState-in-effect is intended here.
    if (readOnly) return;
    const restored = loadRest(session.id);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (restored) setTimer(restored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === "hidden") {
        const t = timerRef.current;
        if (!t) return;
        const remaining = t.seconds - (Date.now() - t.startedAt) / 1000;
        if (remaining > 1) {
          postToServiceWorker({
            type: "rest-timer",
            seconds: remaining,
            nextLabel: t.nextLabel,
          });
        }
      } else {
        postToServiceWorker({ type: "rest-timer-cancel" });
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const settingsGroup = settingsFor
    ? (plannedDay.groups ?? []).find((g) => g.id === settingsFor)
    : undefined;
  const runnerGroup = runnerFor
    ? (plannedDay.groups ?? []).find((g) => g.id === runnerFor)
    : undefined;
  const climbType =
    runnerGroup?.type === "pyramid" || runnerGroup?.type === "ladder"
      ? runnerGroup.type
      : null;
  // Pyramid/ladder groups hold exactly one exercise — the one being climbed.
  const runnerExercise = runnerFor
    ? plannedDay.exercises.find((we) => we.groupId === runnerFor)
    : undefined;
  const intervalType =
    runnerGroup?.type === "hiit" || runnerGroup?.type === "tabata"
      ? runnerGroup.type
      : null;
  // HIIT/Tabata runs rotate through the group's exercises in planned order.
  const runnerExerciseTitles = runnerFor
    ? plannedDay.exercises
        .filter((we) => we.groupId === runnerFor)
        .map((we) => exercisesById.get(we.exerciseId)?.title ?? "Exercise")
    : [];
  // The circuit runner and its settings show the PROGRESSION being performed
  // (the athlete's live pick for this session), not the exercise name.
  function groupProgressionNames(groupId: string | null): string[] {
    if (!groupId) return [];
    return plannedDay.exercises
      .filter((we) => we.groupId === groupId)
      .map((we) => {
        const entry = entries.find((e) => e.workoutExerciseId === we.id);
        const ex = exercisesById.get(entry?.exerciseId ?? we.exerciseId);
        const progressionId = entry?.progressionId ?? we.progressionId;
        return (
          ex?.progressions.find((p) => p.id === progressionId)?.name ??
          ex?.title ??
          "Exercise"
        );
      });
  }
  // Tabata is fixed by definition; HIIT reads this session's settings.
  const intervalSettings =
    intervalType === "tabata"
      ? {
          workSeconds: TABATA.workSeconds,
          restSeconds: TABATA.restSeconds,
          rounds: TABATA.rounds,
        }
      : runnerGroup
        ? {
            workSeconds: settingsOf(runnerGroup).workSeconds ?? 30,
            restSeconds: settingsOf(runnerGroup).restSeconds ?? 30,
            rounds: settingsOf(runnerGroup).rounds ?? 8,
          }
        : null;

  return (
    <div className="space-y-5">
      {/* Sticky header: always visible while scrolling through the workout. */}
      <div className="sticky top-0 z-30 -mx-4 flex items-start justify-between gap-2 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold">{title}</h1>
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
                {INTENSITY_LABELS[plannedDay.intensity]} day
              </span>
            )}
            {weekFocus && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                  weekFocus === "intensification"
                    ? "bg-orange-500/15 text-orange-600"
                    : "bg-sky-500/15 text-sky-600",
                )}
              >
                {WEEK_FOCUS_LABELS[weekFocus]}
              </span>
            )}
            {session.status !== "planned" && (
              <Badge variant="secondary">{session.status}</Badge>
            )}
            {isEditing && (
              <Badge className="bg-primary/15 text-primary">Editing</Badge>
            )}
            {!readOnly && !historical && (
              <span className="flex items-center gap-1 font-medium tabular-nums text-foreground">
                <Timer className="size-4 text-primary" />
                <WorkoutClock baseSeconds={baseSeconds} openedAt={openedAt} />
                <button
                  type="button"
                  aria-label="Reset workout timer"
                  title="Reset workout timer"
                  onClick={resetWorkoutTimer}
                  className="p-0.5 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <RotateCcw className="size-3.5" />
                </button>
              </span>
            )}
            {!readOnly && saveStatus !== "idle" && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                {saveStatus === "saving" ? (
                  <>
                    <Loader2 className="size-3 animate-spin" /> Saving…
                  </>
                ) : (
                  <>
                    <Check className="size-3 text-primary" /> Saved
                  </>
                )}
              </span>
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          aria-label="Open stopwatch"
          title="Stopwatch — for isometric holds"
          onClick={() => setStopwatchOpen(true)}
        >
          <Clock className="size-5" />
        </Button>
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

      {sections.map(({ attribute, exercises: sectionExercises }, si) => (
        <section
          key={attribute}
          className={cn("space-y-3", si > 0 && "border-t pt-6")}
        >
          {/* Tinted, well-padded header so you always know where you are. */}
          <h2 className="rounded-xl bg-primary/10 px-4 py-3 text-sm font-bold uppercase tracking-wide">
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
            const isGroupStart =
              group && (!prev || prev.groupId !== we.groupId);
            const measurement = measurementOf(
              ex,
              entry.progressionId,
              entry.measurement ?? we.measurement,
            );
            const unit = unitOf(ex, measurement);
            const allDone =
              entry.sets.length > 0 && entry.sets.every((s) => s.done);

            return (
              <div key={we.id}>
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
                        onClick={() => setSettingsFor(group.id)}
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
                          onClick={() => {
                            setRunnerRun((n) => n + 1);
                            setRunnerFor(group.id);
                          }}
                        >
                          <Play className="size-3.5" /> Start
                        </Button>
                      )}
                  </div>
                )}
                <Card
                  className={cn(
                    "gap-3 py-4 transition-opacity",
                    group &&
                      `border-l-4 ${GROUP_TYPE_COLORS[group.type].border}`,
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
                          <span className="truncate text-primary">
                            {ex.title}
                          </span>
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
                          Last time ({last.date}):{" "}
                          {volumeLabel(last.performedSets, measurement)}
                        </p>
                      )}
                      {max != null && (
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Trophy className="size-3" />
                          Best single set: {max}
                          {measurement === "reps"
                            ? " reps"
                            : MEASUREMENT_UNIT[measurement]}
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
                          {/* To-Failure: the last set is the one taken to
                              failure — labelled so it can't be missed. */}
                          {group?.type === "to_failure" &&
                          j === entry.sets.length - 1 ? (
                            <span
                              className={cn(
                                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                                GROUP_TYPE_COLORS.to_failure.badge,
                              )}
                            >
                              To-Failure
                            </span>
                          ) : (
                            <span className="w-9 shrink-0 text-xs text-muted-foreground">
                              Set {j + 1}
                            </span>
                          )}
                          {!isHybrid && (
                            <Input
                              type="text"
                              inputMode={
                                measurement === "minutes" ? "decimal" : "numeric"
                              }
                              pattern={
                                measurement === "minutes" ? "[0-9.]*" : "[0-9]*"
                              }
                              disabled={readOnly}
                              placeholder={String(placeholderFor(entry, we, j))}
                              value={s.reps}
                              onFocus={selectAll}
                              onChange={(e) =>
                                updateEntry(we.id, (en) => ({
                                  ...en,
                                  sets: en.sets.map((x, k) =>
                                    k === j
                                      ? {
                                          ...x,
                                          reps: cleanNumeric(
                                            e.target.value,
                                            measurement === "minutes",
                                          ),
                                        }
                                      : x,
                                  ),
                                }))
                              }
                            />
                          )}
                          {!isHybrid &&
                            (isHybridEcc ? (
                              <span className="w-12 shrink-0 text-xs text-muted-foreground">
                                dyn.
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={readOnly}
                                onClick={() => cycleUnit(we.id, measurement)}
                                title="Tap to switch unit: reps → seconds → minutes"
                                className="flex w-12 shrink-0 items-center gap-0.5 text-left text-xs text-muted-foreground underline decoration-dotted underline-offset-2 transition-colors hover:text-foreground disabled:no-underline disabled:opacity-100"
                              >
                                {unit}
                                {!readOnly && (
                                  <ChevronDown className="size-3 shrink-0" />
                                )}
                              </button>
                            ))}
                          {isHybridEcc ? (
                            <>
                              <Input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                placeholder="0"
                                disabled={readOnly}
                                value={s.eccentricReps}
                                onFocus={selectAll}
                                onChange={(e) =>
                                  updateEntry(we.id, (en) => ({
                                    ...en,
                                    sets: en.sets.map((x, k) =>
                                      k === j
                                        ? {
                                            ...x,
                                            eccentricReps: cleanNumeric(
                                              e.target.value,
                                              false,
                                            ),
                                          }
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
                                  onFocus={selectAll}
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
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  placeholder="0"
                                  disabled={readOnly}
                                  className="w-20 shrink-0"
                                  value={part.reps}
                                  onFocus={selectAll}
                                  onChange={(e) =>
                                    updateEntry(we.id, (en) => ({
                                      ...en,
                                      sets: en.sets.map((x, k) =>
                                        k === j
                                          ? {
                                              ...x,
                                              parts: x.parts.map((p, q) =>
                                                q === pi
                                                  ? {
                                                      ...p,
                                                      reps: cleanNumeric(
                                                        e.target.value,
                                                        false,
                                                      ),
                                                    }
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
                                <Plus className="size-4" /> Progression in this
                                set
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
                    {/* Notes are always available and remembered per
                        progression, so they resurface every time you train
                        that progression. */}
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
                        updateEntry(we.id, (en) => ({
                          ...en,
                          notes: e.target.value,
                        }))
                      }
                    />
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
                    updateEntry(we.id, (en) => {
                      const next = { ...en };
                      if (
                        patch.progressionId !== undefined &&
                        patch.progressionId !== en.progressionId
                      ) {
                        // Notes are per progression: stash the current text
                        // under the progression being left (and persist it —
                        // the session save only carries the final
                        // progression's note), then surface the target
                        // progression's own remembered note.
                        const oldKey = exerciseNoteKey(
                          en.exerciseId,
                          en.progressionId,
                        );
                        notesByProgression.current[oldKey] = en.notes ?? "";
                        if (en.notes?.trim()) {
                          rememberNoteMutation.mutate({
                            exerciseId: en.exerciseId,
                            progressionId: en.progressionId,
                            note: en.notes.trim(),
                          });
                        }
                        next.progressionId = patch.progressionId;
                        next.notes =
                          notesByProgression.current[
                            exerciseNoteKey(en.exerciseId, patch.progressionId)
                          ] || undefined;
                      }
                      if (patch.notes !== undefined) next.notes = patch.notes;
                      if (patch.interTechniqueId !== undefined) {
                        next.interTechniqueId =
                          patch.interTechniqueId ?? undefined;
                        // Prefill the remembered note for the current
                        // progression when nothing has been typed yet.
                        if (!next.notes?.trim()) {
                          next.notes =
                            notesByProgression.current[
                              exerciseNoteKey(en.exerciseId, next.progressionId)
                            ];
                        }
                      }
                      return next;
                    })
                  }
                />
              </div>
            );
          })}
        </section>
      ))}

      {/* Read-only history: offer to unlock the same inputs for corrections. */}
      {readOnly && historical && (
        <div className="pb-4">
          <Button
            variant="outline"
            className="w-full"
            size="lg"
            onClick={() => setIsEditing(true)}
          >
            <Pencil className="size-4" /> Edit workout
          </Button>
        </div>
      )}

      {/* Editing a past workout: save the corrections or discard them. */}
      {historical && isEditing && (
        <div className="flex gap-2 pb-4">
          <Button
            className="flex-1"
            size="lg"
            disabled={pending}
            onClick={saveEdits}
          >
            {pending && pendingAction === "complete" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <Check className="size-4" /> Save changes
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            className="flex-1"
            size="lg"
            disabled={pending}
            onClick={cancelEdit}
          >
            Cancel
          </Button>
        </div>
      )}

      {!readOnly && !historical && (
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
        <div
          className="fixed inset-x-0 z-40"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 76px)" }}
        >
          <div className="mx-auto max-w-lg px-4">
            <RestTimer
              key={timer.id}
              seconds={timer.seconds}
              nextLabel={timer.nextLabel}
              startedAt={timer.startedAt}
              onDismiss={() => {
                setTimer(null);
                clearRest(session.id);
                postToServiceWorker({ type: "rest-timer-cancel" });
              }}
            />
          </div>
        </div>
      )}

      {/* Centered stopwatch modal (clock icon in the header). Always
          mounted so it keeps running while the modal is closed. */}
      <Stopwatch open={stopwatchOpen} onOpenChange={setStopwatchOpen} />

      {/* Workout-time mode settings (gear next to a mode badge). Keyed per
          opening so the fields start from the group's current settings. */}
      <ModeSettingsDialog
        key={settingsFor ?? "closed"}
        type={settingsGroup?.type ?? null}
        value={settingsGroup ? settingsOf(settingsGroup) : {}}
        exerciseTitles={groupProgressionNames(settingsFor)}
        onOpenChange={(open) => !open && setSettingsFor(null)}
        onSave={(s) => {
          if (settingsFor) {
            setModeSettings((prev) => ({ ...prev, [settingsFor]: s }));
          }
        }}
      />

      {/* The live pyramid/ladder run (play button on the mode badge). */}
      {runnerGroup && runnerExercise && climbType && (
        <ClimbRunner
          key={`${runnerGroup.id}-${runnerRun}`}
          open
          onOpenChange={(open) => !open && setRunnerFor(null)}
          type={climbType}
          exerciseTitle={
            exercisesById.get(runnerExercise.exerciseId)?.title ?? "Exercise"
          }
          settings={{
            startReps: settingsOf(runnerGroup).startReps ?? 1,
            increment: settingsOf(runnerGroup).increment ?? 1,
            intervalSeconds: settingsOf(runnerGroup).intervalSeconds ?? 60,
          }}
          onRecord={(reps) => recordClimb(runnerExercise, climbType, reps)}
        />
      )}

      {/* The live HIIT/Tabata run (same play button on the mode badge). */}
      {runnerGroup && intervalType && intervalSettings && (
        <IntervalRunner
          key={`${runnerGroup.id}-${runnerRun}`}
          open
          onOpenChange={(open) => !open && setRunnerFor(null)}
          type={intervalType}
          exerciseTitles={runnerExerciseTitles}
          settings={intervalSettings}
        />
      )}

      {/* The live circuit run (same play button on the mode badge). */}
      {runnerGroup && runnerGroup.type === "circuit" && (
        <CircuitRunner
          key={`${runnerGroup.id}-${runnerRun}`}
          open
          onOpenChange={(open) => !open && setRunnerFor(null)}
          exerciseTitles={groupProgressionNames(runnerFor)}
          settings={{
            rounds: settingsOf(runnerGroup).rounds ?? 3,
            stations: circuitStations(
              settingsOf(runnerGroup),
              runnerExerciseTitles.length,
            ),
          }}
          onComplete={() => recordCircuit(runnerGroup)}
        />
      )}

      <Toast message={toastMessage} />
    </div>
  );
}
