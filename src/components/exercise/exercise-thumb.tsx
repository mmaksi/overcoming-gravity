"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Square exercise thumbnail: shows the admin-set image, or falls back to the
 * first letter of the title on a tinted tile when there's no image (or it
 * fails to load). next/image with `sizes="40px"` keeps the download tiny —
 * the optimizer only accepts https URLs (see next.config), so anything else
 * falls back to the letter tile too.
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
  const showImage = imageUrl?.startsWith("https://") && !broken;

  return (
    <div
      className={cn(
        "relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/10 text-base font-bold text-primary",
        className,
      )}
    >
      {showImage ? (
        <Image
          src={imageUrl}
          alt={title}
          fill
          sizes="40px"
          className="object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        (title.trim()[0] ?? "?").toUpperCase()
      )}
    </div>
  );
}
