"use client";

import { useState } from "react";

type Quote = {
  text: string;
  author: string;
  /** Author portrait from the web; falls back to initials if it fails. */
  image?: string;
};

// A small curated set — one is shown per day (deterministic, so server and
// client render the same one and there's no hydration flash).
const QUOTES: Quote[] = [
  {
    text: "The successful warrior is the average man, with laser-like focus.",
    author: "Bruce Lee",
    image:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Bruce_Lee_1973.jpg/240px-Bruce_Lee_1973.jpg",
  },
  {
    text: "It's not about perfect. It's about effort.",
    author: "Jillian Michaels",
  },
  {
    text: "Strength does not come from the physical capacity. It comes from an indomitable will.",
    author: "Mahatma Gandhi",
    image:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Mahatma-Gandhi%2C_studio%2C_1931.jpg/240px-Mahatma-Gandhi%2C_studio%2C_1931.jpg",
  },
  {
    text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.",
    author: "Aristotle",
  },
  {
    text: "The body achieves what the mind believes.",
    author: "Napoleon Hill",
  },
  {
    text: "Take care of your body. It's the only place you have to live.",
    author: "Jim Rohn",
  },
  {
    text: "Discipline is the bridge between goals and accomplishment.",
    author: "Jim Rohn",
  },
];

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * `seed` is computed on the server (days since the epoch) and passed in, so
 * the same quote renders on server and client — no impure clock read during
 * render, no hydration flash.
 */
export function MotivationalQuote({ seed }: { seed: number }) {
  const quote = QUOTES[seed % QUOTES.length];
  const [imageBroken, setImageBroken] = useState(false);
  const showImage = quote.image && !imageBroken;

  return (
    <figure className="flex items-center gap-4 rounded-2xl bg-primary/5 p-4">
      <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-sm font-bold text-primary">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={quote.image}
            alt={quote.author}
            className="size-full object-cover"
            onError={() => setImageBroken(true)}
          />
        ) : (
          initials(quote.author)
        )}
      </div>
      <div className="min-w-0">
        <blockquote className="text-sm font-medium leading-snug">
          “{quote.text}”
        </blockquote>
        <figcaption className="mt-1 text-xs text-muted-foreground">
          — {quote.author}
        </figcaption>
      </div>
    </figure>
  );
}
