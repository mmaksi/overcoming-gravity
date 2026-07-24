/**
 * Everything that tells the athlete a rest period is over: the notifications
 * themselves, and the message protocol for the service worker that owns the
 * countdown when this page cannot (see keep-awake.ts for why it usually can).
 *
 * Both halves live here on purpose. They are one protocol — the page and the
 * worker share a notification tag and must never both be armed — and splitting
 * them across files is how the two ends drift apart.
 */

/** Shared by every rest notification, so a new one replaces the last. */
const TAG = "strong-journal-rest-timer";

/** Best-effort message to the service worker (PWA installs only). */
function postToServiceWorker(message: Record<string, unknown>) {
  try {
    navigator.serviceWorker?.controller?.postMessage(message);
  } catch {
    // No service worker in dev — the in-page rest bar still works.
  }
}

/**
 * Hand the rest of the countdown to the service worker. Only for when this
 * page is not being held awake: the worker will show its own "Resting…" and
 * "Rest over" notifications, so arming both ends would double the alert.
 */
export function armFallbackRest(seconds: number, nextLabel: string) {
  postToServiceWorker({ type: "rest-timer", seconds, nextLabel });
}

/**
 * Drop the worker's countdown but leave any notification on screen — for when
 * the page has just alerted, or is about to.
 */
export function dropFallbackRest() {
  postToServiceWorker({ type: "rest-timer-done" });
}

/**
 * Rest is finished with. Takes the banner away too — unless the app is in the
 * background, where that banner is the only thing telling the athlete rest is
 * over. Dismissal runs on a four-second timer after "Go!", so without that
 * exception it would tidy away the alert nobody has seen.
 */
export function standDownRest() {
  if (document.visibilityState !== "visible") {
    dropFallbackRest();
    return;
  }
  postToServiceWorker({ type: "rest-timer-cancel" });
  void clearRestNotifications();
}

/**
 * Notifications go through the service-worker registration rather than
 * `new Notification()`, which iOS does not implement for web apps at all.
 */
async function registration(): Promise<ServiceWorkerRegistration | null> {
  try {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return null;
    }
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

function granted(): boolean {
  return (
    typeof Notification !== "undefined" && Notification.permission === "granted"
  );
}

/** Quiet placeholder while a rest runs with the app in the background. */
export async function showResting(nextLabel: string, endsAt: number) {
  if (!granted()) return;
  const reg = await registration();
  if (!reg) return;
  const until = new Date(endsAt);
  const hhmm = `${String(until.getHours()).padStart(2, "0")}:${String(until.getMinutes()).padStart(2, "0")}:${String(until.getSeconds()).padStart(2, "0")}`;
  try {
    await reg.showNotification("Resting…", {
      tag: TAG,
      body: `Until ${hhmm} · next: ${nextLabel}`,
      silent: true,
    });
  } catch {
    // ignore
  }
}

/** The alert itself. Fired by the page, foreground or background alike. */
export async function showRestOver(nextLabel: string) {
  if (!granted()) return;
  const reg = await registration();
  if (!reg) return;
  try {
    await reg.showNotification("Rest over 💪", {
      tag: TAG,
      body: nextLabel,
      // `renotify` is what makes a replacement of the quiet "Resting…"
      // notification buzz and sound instead of swapping in silently.
      renotify: true,
      vibrate: [200, 100, 200],
    } as NotificationOptions);
  } catch {
    // ignore
  }
}

export async function clearRestNotifications() {
  const reg = await registration();
  if (!reg) return;
  try {
    const open = await reg.getNotifications({ tag: TAG });
    open.forEach((n) => n.close());
  } catch {
    // ignore
  }
}
