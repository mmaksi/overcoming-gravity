"use client";

import { useEffect } from "react";
import { Smartphone } from "lucide-react";

/**
 * Keeps the app portrait-only. Three layers, weakest platform last:
 * the manifest's `"orientation": "portrait"` locks installed Android; the
 * Screen Orientation API locks where a lock exists (a no-op elsewhere —
 * hence the swallowed rejection); and for iOS, which has no lock at all,
 * the `.landscape-block` overlay (globals.css) covers the screen on phones
 * held sideways so landscape is never a usable state.
 */
export function OrientationLock() {
  useEffect(() => {
    // TS 5.4 dropped the lock() typings (it's still shipped behind flags on
    // some engines), so reach for it defensively.
    const orientation = screen.orientation as unknown as
      | { lock?: (orientation: string) => Promise<void> }
      | undefined;
    orientation?.lock?.("portrait")?.catch(() => {});
  }, []);

  return (
    <div className="landscape-block fixed inset-0 z-[100] flex-col items-center justify-center gap-3 bg-background px-8 text-center">
      <Smartphone className="size-10 rotate-90 text-primary" />
      <p className="font-semibold">Rotate your phone back</p>
      <p className="text-sm text-muted-foreground">
        Strong Journal is designed for portrait.
      </p>
    </div>
  );
}
