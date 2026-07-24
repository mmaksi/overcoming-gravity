"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Check,
  Clock,
  CloudOff,
  Loader2,
  Pencil,
  RotateCcw,
  SkipForward,
  Smartphone,
  Timer,
} from "lucide-react";
import {
  ATTRIBUTE_LABELS,
  GROUP_TYPE_LABELS,
  INTENSITY_LABELS,
  Measurement,
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Toast, useToast } from "@/components/ui/toast";
import { RestTimer, RestTimerState } from "./rest-timer";
import {
  clearRestNotifications,
  isKeepingAwake,
  showResting,
  showRestOver,
  startKeepAwake,
  stopKeepAwake,
} from "./rest-alert";
import { vibrate } from "./sounds";
import { Stopwatch } from "./stopwatch";
import { ClimbRunner } from "./climb-runner";
import { IntervalRunner } from "./interval-runner";
import { CircuitRunner } from "./circuit-runner";
import {
  circuitStations,
  ModeSettings,
  ModeSettingsDialog,
  seedModeSettings,
} from "./mode-settings-dialog";
import {
  clearDraft,
  clearRest,
  loadDraft,
  loadModeSettings,
  loadRest,
  mergeDraftEntries,
  saveDraft,
  saveModeSettings,
  saveRest,
  SessionDraft,
} from "./session-storage";
import { ExerciseCard } from "./exercise-card";
import type { EntryState, RawPart, RawSet } from "./logging-types";
import { cn } from "@/lib/utils";
import { formatClock } from "@/lib/time";

/** The next unit in the reps → seconds → minutes cycle. */
function nextUnit(measurement: Measurement): Measurement {
  return measurement === "reps"
    ? "seconds"
    : measurement === "seconds"
      ? "minutes"
      : "reps";
}

/**
 * Wall-clock read, kept at module scope. The workout clock and the on-device
 * draft are inherently time-stamped, and reading the clock from inside the
 * component trips the purity rule even in effects and handlers where it is
 * legitimate — this is the one place that impurity is admitted.
 */
function nowMs(): number {
  return Date.now();
}

/** Best-effort message to the service worker (PWA installs). */
function postToServiceWorker(message: Record<string, unknown>) {
  try {
    navigator.serviceWorker?.controller?.postMessage(message);
  } catch {
    // No service worker in dev — the in-page rest bar still works.
  }
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
  return formatClock(
    baseSeconds + Math.max(0, Math.floor((now - openedAt) / 1000)),
  );
}

export function WorkoutLogger({
  session,
  title,
  plannedDay,
  isDeload,
  weekFocus,
  exercises,
  stats,
  userNotes = {},
  initialEditing = false,
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
  /** Open a completed workout straight in edit mode (the history pencil). */
  initialEditing?: boolean;
}) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<
    "save" | "complete" | "skip" | null
  >(null);
  const pending = pendingAction !== null;
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
  /**
   * Where this workout currently lives. "local" — on this phone only, which
   * is the normal state while training; "syncing"/"synced" — an explicit save
   * in flight or landed; "failed" — a save that never reached the server,
   * retried the next time the logger opens.
   */
  const [syncState, setSyncState] = useState<
    "local" | "syncing" | "synced" | "failed"
  >("local");
  /** The device refused to store the draft — the athlete must save manually. */
  const [storageBlocked, setStorageBlocked] = useState(false);
  // A completed/skipped session opened from history. Its logger renders
  // read-only until the athlete taps "Edit", which unlocks the same inputs
  // used to log a live workout so past data can be corrected.
  const historical = session.status !== "planned";
  const [isEditing, setIsEditing] = useState(initialEditing && historical);
  const readOnly = historical && !isEditing;

  // Workout duration = `baseSeconds` (active time already banked) + the time
  // since `openedAt` (the current active stretch). Backgrounding the app banks
  // the stretch and pauses the clock; coming back starts a new stretch, so
  // time spent away is never counted. The ticking display is the leaf
  // WorkoutClock, so the whole logger tree isn't re-rendered every second.
  const [baseSeconds, setBaseSeconds] = useState(session.durationSeconds ?? 0);
  const [openedAt, setOpenedAt] = useState(() => Date.now());
  // The clock's authority is this ref, not the state above: pause/resume run
  // from visibilitychange handlers as iOS is freezing the process, and a ref
  // updates there and then. The state exists to drive WorkoutClock's display
  // and may flush a beat later without anything being miscounted.
  const clockRef = useRef({
    base: baseSeconds,
    startedAt: openedAt,
    paused: false,
  });

  /** Elapsed workout seconds right now — for saves (called in handlers). */
  function currentElapsedSeconds(): number {
    const clock = clockRef.current;
    // Editing history must never inflate the recorded duration: the clock is
    // only live while training a planned session, frozen otherwise. A paused
    // clock has already banked everything it earned.
    if (readOnly || historical || clock.paused) return clock.base;
    return (
      clock.base + Math.max(0, Math.floor((nowMs() - clock.startedAt) / 1000))
    );
  }

  /** Bank the running stretch and stop the clock (the app is going away). */
  function pauseClock() {
    if (clockRef.current.paused) return;
    const banked = currentElapsedSeconds();
    const t = nowMs();
    clockRef.current = { base: banked, startedAt: t, paused: true };
    setBaseSeconds(banked);
    setOpenedAt(t);
  }

  /** Start a new active stretch (the app is back in front of the athlete). */
  function resumeClock() {
    if (!clockRef.current.paused) return;
    const t = nowMs();
    clockRef.current = { ...clockRef.current, startedAt: t, paused: false };
    setOpenedAt(t);
  }

  /** Set the clock to a known number of banked seconds and run from now. */
  function startClockAt(seconds: number) {
    const t = nowMs();
    clockRef.current = { base: seconds, startedAt: t, paused: false };
    setBaseSeconds(seconds);
    setOpenedAt(t);
  }

  /** Start the workout duration over from 0:00 (e.g. opened the page early). */
  function resetWorkoutTimer() {
    startClockAt(0);
    persistDraft({ elapsedSeconds: 0 });
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

  // The live entries, mirrored for the event handlers (visibilitychange, the
  // draft writer) that would otherwise close over a stale render's copy.
  const entriesRef = useRef(entries);
  useEffect(() => {
    entriesRef.current = entries;
  });

  /** An explicit save that hasn't reached the server yet, if any. */
  const pendingSyncRef = useRef<"save" | "complete" | "skip" | null>(null);
  /** True once the on-device draft has been read, so writing it is safe. */
  const restoredRef = useRef(false);
  /** Handed over to the server for good — never write this draft again. */
  const finishedRef = useRef(false);

  /**
   * Write the whole workout to this device. This is the save that matters
   * while training: it is synchronous, needs no network, and therefore can't
   * be cut off by the app being backgrounded. The server hears about it only
   * when the athlete saves, completes or skips.
   */
  function persistDraft(overrides?: Partial<SessionDraft>) {
    if (readOnly || historical || finishedRef.current) return;
    const ok = saveDraft(session.id, {
      entries: entriesRef.current,
      elapsedSeconds: currentElapsedSeconds(),
      updatedAt: nowMs(),
      pending: pendingSyncRef.current,
      ...overrides,
    });
    // Storage refused (private mode, device full). This is the only copy of
    // the athlete's sets, so it can't be swallowed the way the rest timer is.
    setStorageBlocked(!ok);
  }

  // Every change to the log is written to the device immediately.
  useEffect(() => {
    if (!restoredRef.current) return; // don't overwrite the draft before it loads
    if (readOnly || historical) return;
    persistDraft();
    if (pendingSyncRef.current === null) setSyncState("local");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

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

  /** Shallow-merge the given fields into one set of an entry, by index. */
  function updateSet(
    workoutExerciseId: string,
    setIndex: number,
    patch: Partial<RawSet>,
  ) {
    updateEntry(workoutExerciseId, (en) => ({
      ...en,
      sets: en.sets.map((x, k) => (k === setIndex ? { ...x, ...patch } : x)),
    }));
  }

  /** Transform the hybrid progression-parts of one set of an entry, by index. */
  function updateSetParts(
    workoutExerciseId: string,
    setIndex: number,
    updater: (parts: RawPart[]) => RawPart[],
  ) {
    updateEntry(workoutExerciseId, (en) => ({
      ...en,
      sets: en.sets.map((x, k) =>
        k === setIndex ? { ...x, parts: updater(x.parts) } : x,
      ),
    }));
  }

  /**
   * Apply an edit from the exercise detail sheet (progression swap, technique,
   * notes). Notes are per progression: swapping progressions stashes and
   * persists the note being left, then surfaces the target's remembered note.
   */
  function handleSheetChange(
    workoutExerciseId: string,
    patch: {
      progressionId?: string;
      interTechniqueId?: string | null;
      notes?: string;
    },
  ) {
    updateEntry(workoutExerciseId, (en) => {
      const next = { ...en };
      if (
        patch.progressionId !== undefined &&
        patch.progressionId !== en.progressionId
      ) {
        const oldKey = exerciseNoteKey(en.exerciseId, en.progressionId);
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
        next.interTechniqueId = patch.interTechniqueId ?? undefined;
        // Prefill the remembered note for the current progression when
        // nothing has been typed yet.
        if (!next.notes?.trim()) {
          next.notes =
            notesByProgression.current[
              exerciseNoteKey(en.exerciseId, next.progressionId)
            ];
        }
      }
      return next;
    });
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
      // This tap is a user gesture, the only moment iOS will let us start
      // audio — and the keep-awake track is what stops the page (and so the
      // rest alert) from being frozen the second the app is backgrounded.
      // Nothing to stay awake for when the exercise prescribes no rest.
      if (we.restSeconds > 0) startKeepAwake(nextLabel);
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
  function resolveEntries(
    action: "save" | "complete",
    /** Defaults to the live entries; the retry-on-open path passes a draft's. */
    source: EntryState[] = entries,
  ): SessionEntry[] {
    return source.map((entry) => {
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

  /** One server write. The payload is built by the caller, never read from
   *  state inside the mutation — the retry-on-open path submits a draft that
   *  isn't in state yet. */
  type SubmitVars = {
    action: "save" | "complete" | "skip";
    entries: SessionEntry[];
    durationSeconds: number;
  };

  // Every server write goes through TanStack Query, and only ever from an
  // explicit save/complete/skip — there is no background autosave any more
  // (see session-storage.ts). Completing or skipping changes the client-cached
  // history + progress reads; a "save" leaves the session planned, so it
  // changes neither. Navigation is done by the caller after awaiting, not
  // here: a router.push queued in the same tick as the action's revalidation
  // is swallowed in this Next fork.
  const submitMutation = useMutation({
    mutationFn: (vars: SubmitVars) =>
      saveWorkoutSession({
        sessionId: session.id,
        entries: vars.entries,
        action: vars.action,
        durationSeconds: vars.durationSeconds,
      }),
    onSuccess: (_result, vars) => {
      if (vars.action === "save") return;
      queryClient.invalidateQueries({ queryKey: queryKeys.history() });
      queryClient.invalidateQueries({ queryKey: queryKeys.progress() });
    },
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

  /**
   * Push the workout to the server. Records the intent on the device first,
   * so a failure here leaves a draft that says what the athlete was trying to
   * do — the next open finishes the job. Returns null when the server was
   * unreachable; the workout is still safe on the phone.
   */
  async function syncToServer(vars: SubmitVars) {
    pendingSyncRef.current = vars.action;
    persistDraft({ pending: vars.action, elapsedSeconds: vars.durationSeconds });
    setSyncState("syncing");
    try {
      const result = await submitMutation.mutateAsync(vars);
      pendingSyncRef.current = null;
      if (vars.action === "save") {
        // Still training: keep the draft, just no longer waiting to be sent.
        persistDraft({ pending: null, elapsedSeconds: vars.durationSeconds });
      } else {
        // Finished or skipped — the server owns this session now. Nothing may
        // re-create the draft afterwards (a pagehide during the navigation
        // away would otherwise leave an orphan behind).
        finishedRef.current = true;
        clearDraft(session.id);
      }
      setSyncState("synced");
      return result;
    } catch {
      setSyncState("failed");
      return null;
    }
  }

  /** The payload for an action, from the live entries or a restored draft. */
  function submitVars(
    action: "save" | "complete" | "skip",
    source?: EntryState[],
    durationSeconds = currentElapsedSeconds(),
  ): SubmitVars {
    return {
      action,
      entries:
        action === "skip" ? [] : resolveEntries(action, source),
      durationSeconds,
    };
  }

  async function submit(action: "save" | "complete" | "skip") {
    // Synchronous guard so a double-tap can't fire two submits (the derived
    // `pending` only flips once the mutation starts, after the await).
    if (pending) return;
    setPendingAction(action);
    setTimer(null);
    clearRest(session.id);
    stopKeepAwake();
    postToServiceWorker({ type: "rest-timer-cancel" });
    void clearRestNotifications();
    const result = await syncToServer(submitVars(action));
    if (!result) {
      setPendingAction(null);
      toast(
        "No connection — this workout is saved on your phone and will sync next time you open it.",
      );
      return;
    }
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
  }

  /**
   * A save/complete/skip that never reached the server last time, replayed
   * when the logger reopens. The entries come from the draft (state hasn't
   * caught up yet at this point), and a failure simply leaves it pending for
   * the next open.
   */
  async function retryPendingSync(draft: SessionDraft) {
    if (!draft.pending) return;
    // Offline for sure — don't burn a request, the next open will try again.
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    const merged = mergeDraftEntries(buildInitialEntries(), draft.entries);
    setPendingAction(draft.pending);
    const result = await syncToServer(
      submitVars(draft.pending, merged, draft.elapsedSeconds),
    );
    if (!result) {
      setPendingAction(null);
      return;
    }
    if (draft.pending === "save") {
      setPendingAction(null);
      toast("Your last save is now synced.");
      return;
    }
    if (result.runCompleted && result.programId) {
      router.push(`/programs/${result.programId}`);
    } else if (draft.pending === "complete") {
      router.push(`/workout/${session.id}/congrats`);
    } else {
      router.push("/");
    }
  }

  /**
   * Persist edits to a completed workout, keeping it completed. Reuses the
   * "complete" action so the history + progress caches refresh (the run is
   * already finished, so this never re-triggers completion navigation). On
   * success the athlete is sent to the training page — the push happens after
   * the await so this fork doesn't swallow it behind the action's revalidation.
   */
  async function saveEdits() {
    if (pending) return;
    setPendingAction("complete");
    try {
      await submitMutation.mutateAsync(submitVars("complete"));
      router.push("/programs");
    } catch {
      setPendingAction(null);
      toast("Couldn't save those corrections — check your connection.");
    }
  }

  // Restore this device's draft — mount-only, and necessarily in an effect:
  // the server can't read localStorage, so this must run post-hydration. The
  // draft is always the newer copy of a workout in progress, so it wins over
  // what the server rendered into this page.
  useEffect(() => {
    if (readOnly || historical) {
      restoredRef.current = true;
      return;
    }
    const draft = loadDraft(session.id);
    restoredRef.current = true;
    if (!draft) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setEntries((prev) => mergeDraftEntries(prev, draft.entries));
    // The clock resumes from the banked time, not from zero.
    startClockAt(draft.elapsedSeconds);
    // A save that never made it to the server last time: finish it now.
    if (draft.pending) {
      pendingSyncRef.current = draft.pending;
      setSyncState("failed");
      void retryPendingSync(draft);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Discard in-progress edits and restore the workout's saved values. */
  function cancelEdit() {
    if (pending) return;
    setEntries(buildInitialEntries());
    setIsEditing(false);
  }

  // Leaving the app banks the workout clock and writes the draft — both
  // synchronous and local. Deliberately no network call here: a server action
  // fired as iOS suspends the PWA has its response cut mid-stream, and that
  // half-delivered response is what used to crash the logger on return.
  const leaveRef = useRef<() => void>(() => undefined);
  const returnRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    leaveRef.current = () => {
      if (readOnly || historical) return;
      pauseClock();
      persistDraft();
    };
    returnRef.current = () => {
      if (readOnly || historical) return;
      resumeClock();
    };
  });
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === "hidden") leaveRef.current();
      else returnRef.current();
    }
    function onPageHide() {
      leaveRef.current();
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, []);

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

  /**
   * Stand the service worker down and take the banner away — except when the
   * app is in the background, where that banner is the only thing telling the
   * athlete rest is over. Dismissal runs on a four-second timer after "Go!",
   * so without that exception it would tidy away the alert nobody has seen.
   */
  function standDownRest() {
    const visible = document.visibilityState === "visible";
    postToServiceWorker({
      type: visible ? "rest-timer-cancel" : "rest-timer-done",
    });
    if (visible) void clearRestNotifications();
  }

  /**
   * The countdown reached zero. The alert fires wherever the athlete is,
   * inside the app or out of it — "your set is ready" is worth nothing as a
   * foreground-only event.
   */
  function restOver() {
    // Whatever the worker was holding for this rest is now redundant; drop it
    // without closing notifications, since one is about to go up.
    postToServiceWorker({ type: "rest-timer-done" });
    clearRest(session.id);
    // The live state, not `timerRef`: a zero-second rest is over on the bar's
    // very first render, and the ref is only synced by an effect afterwards.
    const t = timer;
    // A page that got frozen anyway (keep-awake switched off, or playback
    // refused) thaws on reopening and crosses zero right then. Alerting there
    // reproduces the exact bug this path exists to fix — a buzz for a rest
    // that ended minutes ago — so a stale crossing passes in silence.
    const stale = !t || nowMs() - (t.startedAt + t.seconds * 1000) > 5000;
    if (stale) {
      stopKeepAwake();
      return;
    }
    vibrate();
    // The audio session goes back only once the notification is actually up.
    // Backgrounded, that track is the only reason this page is still running;
    // releasing it first lets iOS freeze us mid-await, with nothing shown.
    void showRestOver(t.nextLabel).then(stopKeepAwake, stopKeepAwake);
  }

  /** Rest cleared: dismissed by the athlete, or by the bar timing itself out. */
  function dismissRest() {
    setTimer(null);
    clearRest(session.id);
    stopKeepAwake();
    standDownRest();
  }
  // Leaving the app mid-rest: one of two things owns the countdown from here.
  // If the keep-awake track is playing the page survives being backgrounded
  // and will fire its own alert on time (see `restOver` above), so all we do
  // is put up a quiet placeholder. If it is not — the athlete switched it off,
  // or iOS refused playback — the countdown goes to the service worker, which
  // is dependable on Android and desktop and a long shot on iOS.
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === "hidden") {
        const t = timerRef.current;
        if (!t) return;
        const endsAt = t.startedAt + t.seconds * 1000;
        if (endsAt - nowMs() <= 1000) return;
        if (isKeepingAwake()) {
          void showResting(t.nextLabel, endsAt);
          return;
        }
        postToServiceWorker({
          type: "rest-timer",
          seconds: (endsAt - nowMs()) / 1000,
          nextLabel: t.nextLabel,
        });
      } else {
        // Back in the app: the rest bar is the UI again, so drop the banner
        // and stand the worker down before it can fire a duplicate.
        postToServiceWorker({ type: "rest-timer-cancel" });
        void clearRestNotifications();
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // The page is going away for good (navigation, tab close): nothing is left
  // to fire an alert, and a still-playing track would keep the athlete's music
  // hostage, so hand back the audio session on the way out.
  useEffect(() => stopKeepAwake, []);

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
            {/* Where the workout currently lives. While training it lives on
                this phone; the server only hears about it on save/complete. */}
            {!readOnly && !historical && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                {syncState === "syncing" ? (
                  <>
                    <Loader2 className="size-3 animate-spin" /> Saving…
                  </>
                ) : syncState === "synced" ? (
                  <>
                    <Check className="size-3 text-primary" /> Synced
                  </>
                ) : syncState === "failed" ? (
                  <span className="flex items-center gap-1 text-amber-600">
                    <CloudOff className="size-3" /> Not synced yet
                  </span>
                ) : (
                  <>
                    <Smartphone className="size-3" /> Saved on this phone
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

      {storageBlocked && !readOnly && !historical && (
        <Alert>
          <AlertTitle>This phone won&apos;t store your workout</AlertTitle>
          <AlertDescription>
            Private browsing or a full device — we can&apos;t keep your sets
            here between visits. Tap &quot;Save progress&quot; now and then so
            nothing is lost.
          </AlertDescription>
        </Alert>
      )}

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
            return (
              <ExerciseCard
                key={we.id}
                we={we}
                prev={sectionExercises[i - 1]}
                entry={entry}
                ex={ex}
                stats={stats}
                plannedDay={plannedDay}
                readOnly={readOnly}
                sheetOpen={openSheetFor === we.id}
                settingsOf={settingsOf}
                updateEntry={updateEntry}
                updateSet={updateSet}
                updateSetParts={updateSetParts}
                toggleSetDone={toggleSetDone}
                cycleUnit={cycleUnit}
                placeholderFor={placeholderFor}
                onOpenSettings={(groupId) => setSettingsFor(groupId)}
                onStartRunner={(groupId) => {
                  setRunnerRun((n) => n + 1);
                  setRunnerFor(groupId);
                }}
                onSheetOpenChange={(open) =>
                  setOpenSheetFor(open ? we.id : null)
                }
                onSheetChange={handleSheetChange}
              />
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
              onOver={restOver}
              onDismiss={dismissRest}
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
