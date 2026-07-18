"use client";

import { useEffect } from "react";

/** Registers the service worker (production only — caching fights dev HMR). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      process.env.NODE_ENV === "production" &&
      "serviceWorker" in navigator
    ) {
      // updateViaCache "none": always check the network for a new sw.js, so
      // a deploy rolls out to installed PWAs on their next open instead of
      // whenever the HTTP cache feels like revalidating.
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .catch(() => {
          // PWA is progressive enhancement; ignore registration failures.
        });
    }
  }, []);
  return null;
}
