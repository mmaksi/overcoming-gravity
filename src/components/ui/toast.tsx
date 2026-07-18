"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

/**
 * Minimal transient confirmation. Call `toast(message)` and render
 * `<Toast message={message} />`: a pill fades in above the bottom nav and
 * disappears on its own. One message at a time — a new call replaces the
 * current one and restarts the timer.
 */
export function useToast(durationMs = 2500) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback(
    (msg: string) => {
      setMessage(msg);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setMessage(null), durationMs);
    },
    [durationMs],
  );

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return { message, toast };
}

export function Toast({ message }: { message: string | null }) {
  return (
    // Always mounted so screen readers announce updates to the live region.
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 pb-[env(safe-area-inset-bottom)]"
    >
      {message && (
        <div className="flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background shadow-lg animate-in fade-in-0 slide-in-from-bottom-2">
          <Check className="size-4" />
          {message}
        </div>
      )}
    </div>
  );
}
