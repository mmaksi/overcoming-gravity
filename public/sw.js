/* Strong Journal service worker: offline-capable app shell.
 * - navigations: network-first, falling back to the cached shell
 * - static assets (/_next/static, icons, fonts): cache-first
 */
const VERSION = "v4";
const SHELL_CACHE = `shell-${VERSION}`;
const ASSET_CACHE = `assets-${VERSION}`;
const SHELL_URLS = ["/", "/programs", "/calendar", "/settings"];
/** Offline-fallback pages kept at most (see the navigation prune below). */
const MAX_SHELL_PAGES = 60;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then(async (cache) => {
            await cache.put(request, copy);
            // Bound the cache: pages like /workout/<id> mint a new URL per
            // session, so without pruning this grows forever. Cache keys
            // come back in insertion order — drop the oldest overflow.
            const keys = await cache.keys();
            const overflow = keys.length - MAX_SHELL_PAGES;
            for (let i = 0; i < overflow; i++) await cache.delete(keys[i]);
          });
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached ?? caches.match("/")),
        ),
    );
    return;
  }

  const isStatic =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/sound-effects/") ||
    url.pathname === "/manifest.webmanifest";
  if (isStatic) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy));
            return response;
          }),
      ),
    );
  }
});

/* Rest-period notifications — the fallback path.
 *
 * The page alerts for itself whenever it is alive, which now includes being
 * backgrounded (it holds an inaudible track playing to stay that way; see
 * components/workout/rest-alert.ts). This worker takes the countdown only
 * when that is not running: the page posts {type: "rest-timer"} with the
 * REMAINING seconds, we show a quiet "Resting…" notification and replace it
 * with "Rest over" at the end. Dependable on Android and desktop; on iOS the
 * worker is frozen along with the app, which is exactly why the page holds
 * itself awake rather than trusting this.
 *
 * Two ways to stand down: {type: "rest-timer-done"} drops a pending countdown
 * and leaves notifications alone (the page has just alerted, or is about to);
 * {type: "rest-timer-cancel"} also closes them, for when the athlete is back
 * in the app and the rest bar is the UI again. */
let restTimeout = null;
let restDone = null; // resolves the waitUntil promise below

function cancelRest() {
  if (restTimeout) clearTimeout(restTimeout);
  restTimeout = null;
  if (restDone) restDone();
  restDone = null;
}

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || typeof data !== "object") return;

  if (data.type === "rest-timer") {
    const { seconds, nextLabel } = data;
    cancelRest();
    const until = new Date(Date.now() + seconds * 1000);
    const hhmm = `${String(until.getHours()).padStart(2, "0")}:${String(until.getMinutes()).padStart(2, "0")}:${String(until.getSeconds()).padStart(2, "0")}`;
    self.registration.showNotification("Resting…", {
      tag: "strong-journal-rest-timer",
      body: `Until ${hhmm} · next: ${nextLabel}`,
      silent: true,
    });
    // waitUntil keeps this worker alive for the rest period — otherwise the
    // browser may kill it as idle and "Rest over" never fires while the app
    // is backgrounded.
    event.waitUntil(
      new Promise((resolve) => {
        restDone = resolve;
        restTimeout = setTimeout(() => {
          restTimeout = null;
          restDone = null;
          self.registration
            .showNotification("Rest over 💪", {
              tag: "strong-journal-rest-timer",
              body: nextLabel,
              renotify: true,
              vibrate: [200, 100, 200],
            })
            .then(resolve, resolve);
        }, seconds * 1000);
      }),
    );
  }

  if (data.type === "rest-timer-done") {
    cancelRest();
  }

  if (data.type === "rest-timer-cancel") {
    cancelRest();
    self.registration
      .getNotifications({ tag: "strong-journal-rest-timer" })
      .then((notifications) => notifications.forEach((n) => n.close()));
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const client = clients[0];
        if (client) return client.focus();
        return self.clients.openWindow("/");
      }),
  );
});
