/**
 * Best-effort `localStorage` persistence for a workout session's in-flight,
 * client-only state — the running rest timer and the workout-time mode
 * settings — so they survive navigating away and back without a server write.
 * Every call swallows failures (private mode, storage full): the in-page state
 * is the source of truth, this is just a convenience that survives reloads.
 */
import type { RestTimerState } from "./rest-timer";
import type { ModeSettings } from "./mode-settings-dialog";

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
