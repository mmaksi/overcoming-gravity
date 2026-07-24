/**
 * Holding the page awake through a rest period.
 *
 * iOS suspends a backgrounded PWA, and it suspends the service worker with it,
 * so a `setTimeout` scheduled for the end of a rest simply does not run — it
 * fires the moment the app is reopened, which is precisely when the alert is
 * worthless. The one dependable exemption is audio: a page holding a live
 * media session keeps running in the background. So for the length of a rest
 * we loop an inaudible track, and the page stays alive to alert for itself
 * (see rest-alert.ts).
 *
 * The cost is worth stating plainly: iOS hands audio to one app at a time, so
 * this pauses whatever the athlete was listening to. That is why it is a
 * device preference rather than something the app just does.
 */
import { createSound, playSound } from "./sounds";

const STORAGE_KEY = "strong-journal-keep-awake";

/** Default on: an alert that never arrives is the bug this exists to fix. */
export function keepAwakeEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setKeepAwakeEnabled(on: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {
    // Private mode — the preference holds for this visit only.
  }
}

function writeAscii(view: DataView, offset: number, text: string) {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

/**
 * Five seconds of 40 Hz at about -60 dB, built as a WAV in memory. It loops,
 * so it covers a rest of any length.
 *
 * Generated rather than shipped as a file for three reasons: there is no audio
 * asset in the repo whose entire content is nothing; nothing has to be
 * downloaded, so it works in a basement gym on the first rest of a fresh
 * install; and a WAV loops gaplessly where an MP3 carries encoder padding. The
 * length is a whole number of cycles, so the seam lands on a zero crossing and
 * cannot click.
 *
 * Not literal silence: a track of pure zeroes is the kind of thing a platform
 * may reasonably decide not to bother playing, and the entire point is to hold
 * a genuine media session. At this amplitude a phone speaker cannot produce it.
 */
function keepAwakeUrl(): string {
  const rate = 8000;
  const samples = rate * 5;
  const bytes = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(bytes);
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + samples * 2, true);
  writeAscii(view, 8, "WAVEfmt ");
  view.setUint32(16, 16, true); // PCM header length
  view.setUint16(20, 1, true); // uncompressed
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true); // bytes per second
  view.setUint16(32, 2, true); // bytes per frame
  view.setUint16(34, 16, true); // bits per sample
  writeAscii(view, 36, "data");
  view.setUint32(40, samples * 2, true);
  for (let i = 0; i < samples; i++) {
    const sample = Math.sin((2 * Math.PI * 40 * i) / rate) * 30;
    view.setInt16(44 + i * 2, Math.round(sample), true);
  }
  return URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
}

/**
 * One element for the whole tab, built on the first rest. Reusing it matters:
 * iOS only lets an element play unprompted once it has been started from a
 * user gesture, and the set checkbox that starts the first rest is the gesture
 * that earns that right.
 */
let keeper: HTMLAudioElement | null = null;

function keepAwakeElement(): HTMLAudioElement | null {
  if (!keeper) {
    keeper = createSound(keepAwakeUrl());
    if (keeper) keeper.loop = true;
  }
  return keeper;
}

/**
 * Hold the page awake for the coming rest. Call from a user gesture (ticking
 * the set), otherwise iOS refuses playback and the fallback path applies.
 */
export function startKeepAwake(nextLabel: string) {
  if (!keepAwakeEnabled()) return;
  const audio = keepAwakeElement();
  if (!audio) return;
  playSound(audio);
  // Playing audio puts the app on the lock screen and in Control Centre.
  // Without metadata it shows up as a nameless player; this says what it is.
  try {
    if ("mediaSession" in navigator && typeof MediaMetadata !== "undefined") {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: "Resting",
        artist: nextLabel,
        album: "Strong Journal",
      });
    }
  } catch {
    // Unsupported — the player just stays unlabelled.
  }
}

export function stopKeepAwake() {
  if (!keeper) return;
  try {
    keeper.pause();
    keeper.currentTime = 0;
  } catch {
    // Nothing to do; the element is already idle.
  }
  try {
    if ("mediaSession" in navigator) navigator.mediaSession.metadata = null;
  } catch {
    // ignore
  }
}

/**
 * Is the track actually playing? Decides who owns the countdown when the app
 * goes to the background: a page being held awake fires its own alert, one
 * that is not hands the rest to the service worker.
 */
export function isKeepingAwake(): boolean {
  return !!keeper && !keeper.paused && !keeper.ended;
}
