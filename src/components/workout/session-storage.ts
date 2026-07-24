/**
 * `localStorage` persistence for a workout session's in-flight state: the
 * recorded sets themselves (the draft), the workout clock, the running rest
 * timer and the workout-time mode settings.
 *
 * The draft is the source of truth while training. The server is written only
 * when the athlete explicitly saves, completes or skips — so nothing is ever
 * in flight at the moment iOS suspends a backgrounded PWA, which is what used
 * to cut a server action's response mid-stream and crash the logger.
 *
 * The rest timer and mode settings stay best-effort (every call swallows
 * failures): they are conveniences. A failed *draft* write is not swallowed
 * silently — it is the only copy of the athlete's sets, so `saveDraft`
 * reports it and the logger nudges them to save to the server instead.
 */
import type { RestTimerState } from "./rest-timer";
import type { ModeSettings } from "./mode-settings-dialog";
import type { EntryState } from "./logging-types";

/** localStorage key for a session's in-flight rest, so it survives navigation. */
function restKey(sessionId: string) {
  return `strong-journal-rest:${sessionId}`;
}

export function saveRest(sessionId: string, timer: RestTimerState) {
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

export function clearRest(sessionId: string) {
  try {
    localStorage.removeItem(restKey(sessionId));
  } catch {
    // ignore
  }
}

/** Restore a still-running rest for this session, or null if none/expired. */
export function loadRest(sessionId: string): RestTimerState | null {
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

export function loadModeSettings(
  sessionId: string,
): Record<string, ModeSettings> {
  try {
    const raw = localStorage.getItem(modesKey(sessionId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveModeSettings(
  sessionId: string,
  settings: Record<string, ModeSettings>,
) {
  try {
    localStorage.setItem(modesKey(sessionId), JSON.stringify(settings));
  } catch {
    // Private mode / storage full — settings still hold for this visit.
  }
}

/**
 * The athlete's live log for one session, held on this device. What the
 * server has is whatever was last explicitly saved; this is always the newer
 * copy while a workout is in progress.
 */
export type SessionDraft = {
  entries: EntryState[];
  /**
   * Workout seconds so far. Wall time, background included — only a fresh
   * page load resumes from this figure instead of counting through the gap.
   */
  elapsedSeconds: number;
  /** Epoch ms of the last write — how we know this copy is the newer one. */
  updatedAt: number;
  /**
   * An explicit save/complete/skip that never reached the server (offline,
   * dropped connection). Retried the next time the logger opens.
   */
  pending: "save" | "complete" | "skip" | null;
};

function draftKey(sessionId: string) {
  return `strong-journal-draft:${sessionId}`;
}

/**
 * Persist the draft. Returns false when the device refused the write (private
 * mode, storage full) — the caller must surface that, because unlike the rest
 * timer this is the athlete's actual training data.
 */
export function saveDraft(sessionId: string, draft: SessionDraft): boolean {
  try {
    localStorage.setItem(draftKey(sessionId), JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function loadDraft(sessionId: string): SessionDraft | null {
  try {
    const raw = localStorage.getItem(draftKey(sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Anything malformed (hand-edited storage, an older shape) is discarded
    // rather than fed into the logger as entries.
    if (!parsed || !Array.isArray(parsed.entries)) return null;
    return {
      entries: parsed.entries,
      elapsedSeconds:
        typeof parsed.elapsedSeconds === "number" ? parsed.elapsedSeconds : 0,
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : 0,
      pending:
        parsed.pending === "save" ||
        parsed.pending === "complete" ||
        parsed.pending === "skip"
          ? parsed.pending
          : null,
    };
  } catch {
    return null;
  }
}

export function clearDraft(sessionId: string) {
  try {
    localStorage.removeItem(draftKey(sessionId));
  } catch {
    // ignore
  }
}

/**
 * Lay a restored draft over the plan-seeded entries. The plan decides which
 * exercises exist — it may have been edited in the designer since the draft
 * was written — and the draft supplies what the athlete actually logged. So:
 * an exercise dropped from the plan is dropped from the draft too, one added
 * to the plan appears with its seeded (empty) sets, and anything malformed is
 * ignored rather than fed into the logger.
 */
export function mergeDraftEntries(
  seeded: EntryState[],
  drafted: EntryState[],
): EntryState[] {
  const byId = new Map(drafted.map((e) => [e.workoutExerciseId, e]));
  return seeded.map((entry) => {
    const draft = byId.get(entry.workoutExerciseId);
    if (!draft || !Array.isArray(draft.sets)) return entry;
    return { ...entry, ...draft, workoutExerciseId: entry.workoutExerciseId };
  });
}
