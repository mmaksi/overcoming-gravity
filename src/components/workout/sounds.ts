/**
 * Sound and haptic feedback for the mode runners. All best-effort: every call
 * swallows failures (SSR, autoplay policies, missing files, unsupported
 * hardware) — the visual timers are the source of truth, sound and buzz are
 * garnish.
 */

/** A short double-buzz marking a phase change on devices that support it. */
export function vibrate() {
  try {
    navigator.vibrate?.([180, 80, 180]);
  } catch {
    // Unsupported — the visual change is enough.
  }
}

/** "4… 3… 2… 1" voice for the get-ready countdown. */
export const COUNTDOWN_SRC = "/sound-effects/4321.mp3";
/** Sharp beep marking "back to work" in HIIT / Tabata. */
export const START_BEEP_SRC = "/sound-effects/start-beep.mp3";

export function createSound(src: string): HTMLAudioElement | null {
  if (typeof Audio === "undefined") return null;
  const audio = new Audio(src);
  audio.preload = "auto";
  return audio;
}

export function playSound(audio: HTMLAudioElement | null) {
  if (!audio) return;
  try {
    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
  } catch {
    // Autoplay refused — the visual cue carries it.
  }
}

/**
 * Prime a sound while the user's tap is still "recent" (transient
 * activation), so mobile browsers allow the later timer-driven plays:
 * a muted play-then-rewind whitelists the element.
 */
export function unlockSound(audio: HTMLAudioElement | null) {
  if (!audio) return;
  try {
    audio.muted = true;
    void audio
      .play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
      })
      .catch(() => {
        audio.muted = false;
      });
  } catch {
    audio.muted = false;
  }
}
