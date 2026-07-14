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
      "https://californiamuseum.org/wp-content/uploads/brucelee_cahalloffameinductee-1.png",
  },
  {
    text: "If you think you are only strong if you can lift a certain number, whatever that number is, you will feel pretty weak most of the time. Strength is not a data point; it's not a number. It's an attitude.",
    author: "Pavel Tsatsouline",
    image:
      "https://cdn.prod.website-files.com/64751ad903a904b42aa4adc1/67a96f8755e2cc7d8d6a3810_SITE_PT_L1000774.webp",
  },
  {
    text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.",
    author: "Aristotle",
    image:
      "https://wordsworth-editions.com/cms/wp-content/uploads/2022/05/Aristole-Author.jpg",
  },
  {
    text: "Every man is the builder of a temple, called his body, to the god he worships, after a style purely his own, nor can he get off by hammering marble instead. We are all sculptors and painters, and our material is our own flesh and blood and bones. Any nobleness begins at once to refine a man's features, any meanness or sensuality to imbrute them.",
    author: "Henry D. Thoreau",
    image:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Henry_David_Thoreau_2.jpg/250px-Henry_David_Thoreau_2.jpg?utm_source=de.wikisource.org&utm_campaign=parser&utm_content=thumbnail",
  },
  {
    text: "I hated every minute of training, but I said, 'Don't quit. Suffer now and live the rest of your life as a champion.'",
    author: "Muhammad Ali",
    image:
      "https://img.olympics.com/images/image/private/t_1-1_300/f_auto/primary/mn3mqf9td4yupcdzyvlq",
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
