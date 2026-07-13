"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Square exercise thumbnail: shows the admin-set image, or falls back to the
 * first letter of the title on a tinted tile when there's no image (or it
 * fails to load).
 */
export function ExerciseThumb({
  title,
  imageUrl,
  className,
}: {
  title: string;
  imageUrl?: string;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const showImage = imageUrl && !broken;

  return (
    <div
      className={cn(
        "flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/10 text-base font-bold text-primary",
        className,
      )}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={title}
          className="size-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        (title.trim()[0] ?? "?").toUpperCase()
      )}
    </div>
  );
}
