"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Re-render Settings when the user comes back from the payment provider's
 * hosted pages (checkout, billing portal). Leaving happens via
 * window.location, so returning with the browser back arrow restores this
 * page from the back/forward cache — the server component (and with it the
 * subscription re-sync) never runs, and a cancellation made on the portal
 * would still show as "renews". `router.refresh()` re-runs the server
 * component; the sync on the Settings page does the rest.
 */
export function BillingRefresh() {
  const router = useRouter();
  const lastRefresh = useRef(0);

  useEffect(() => {
    function refresh() {
      // A visibility flip and a pageshow can fire together — one pull is
      // enough, and each refresh costs a provider API call.
      const now = Date.now();
      if (now - lastRefresh.current < 5_000) return;
      lastRefresh.current = now;
      router.refresh();
    }
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) refresh();
    }
    function onVisibilityChange() {
      if (document.visibilityState === "visible") refresh();
    }
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [router]);

  return null;
}
