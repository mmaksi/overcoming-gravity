"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** Round profile picture with a first-initial fallback. */
export function UserAvatar({
  name,
  avatarUrl,
  className,
}: {
  name: string;
  avatarUrl?: string;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const showImage = avatarUrl && !broken;

  return (
    <div
      className={cn(
        "flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-lg font-bold text-primary",
        className,
      )}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt={name}
          className="size-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        (name.trim()[0] ?? "?").toUpperCase()
      )}
    </div>
  );
}
