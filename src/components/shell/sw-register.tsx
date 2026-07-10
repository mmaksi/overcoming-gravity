"use client";

import { useEffect } from "react";

/** Registers the service worker (production only — caching fights dev HMR). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      process.env.NODE_ENV === "production" &&
      "serviceWorker" in navigator
    ) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // PWA is progressive enhancement; ignore registration failures.
      });
    }
  }, []);
  return null;
}
