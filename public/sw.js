/* Cali Pro service worker: offline-capable app shell.
 * - navigations: network-first, falling back to the cached shell
 * - static assets (/_next/static, icons, fonts): cache-first
 */
const VERSION = "v1";
const SHELL_CACHE = `shell-${VERSION}`;
const ASSET_CACHE = `assets-${VERSION}`;
const SHELL_URLS = ["/", "/programs", "/calendar", "/settings"];

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
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
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

/* Rest-period notifications: the page posts {type: "rest-timer"} when a set
 * is checked. We immediately show a persistent "resting" notification (so it
 * survives the app going to the background) and replace it with "rest over"
 * when the period ends. {type: "rest-timer-cancel"} clears everything. */
let restTimeout = null;

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || typeof data !== "object") return;

  if (data.type === "rest-timer") {
    const { seconds, nextLabel } = data;
    if (restTimeout) clearTimeout(restTimeout);
    const until = new Date(Date.now() + seconds * 1000);
    const hhmm = `${String(until.getHours()).padStart(2, "0")}:${String(until.getMinutes()).padStart(2, "0")}:${String(until.getSeconds()).padStart(2, "0")}`;
    self.registration.showNotification("Resting…", {
      tag: "cali-rest-timer",
      body: `Until ${hhmm} · next: ${nextLabel}`,
      silent: true,
    });
    restTimeout = setTimeout(() => {
      restTimeout = null;
      self.registration.showNotification("Rest over 💪", {
        tag: "cali-rest-timer",
        body: nextLabel,
        renotify: true,
      });
    }, seconds * 1000);
  }

  if (data.type === "rest-timer-cancel") {
    if (restTimeout) clearTimeout(restTimeout);
    restTimeout = null;
    self.registration
      .getNotifications({ tag: "cali-rest-timer" })
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
