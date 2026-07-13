"use client";

import { Children, ReactNode, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Swipeable carousel for the active-program cards: CSS scroll-snap does the
 * swiping, JS only tracks which card is in view for the dots. With a single
 * card it renders plainly.
 */
export function RunCarousel({ children }: { children: ReactNode }) {
  const items = Children.toArray(children);
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  if (items.length <= 1) return <>{items}</>;

  return (
    <div className="space-y-2">
      <div
        ref={trackRef}
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]"
        onScroll={() => {
          const track = trackRef.current;
          if (!track || !track.firstElementChild) return;
          const step =
            track.firstElementChild.getBoundingClientRect().width + 12; // gap-3
          setActive(
            Math.min(items.length - 1, Math.round(track.scrollLeft / step)),
          );
        }}
      >
        {items.map((item, i) => (
          <div key={i} className="w-[88%] shrink-0 snap-center">
            {item}
          </div>
        ))}
      </div>
      <div className="flex justify-center gap-1.5">
        {items.map((_, i) => (
          <span
            key={i}
            className={cn(
              "size-2 rounded-full transition-colors",
              i === active ? "bg-primary" : "bg-muted-foreground/30",
            )}
          />
        ))}
      </div>
    </div>
  );
}
