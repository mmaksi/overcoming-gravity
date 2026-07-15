import { Lightbulb } from "lucide-react";

// A curated set of calisthenics training tips — one is shown per day. The
// pick is deterministic for a given day seed (computed on the server) so the
// server and client render the same tip with no hydration flash.
const TIPS: string[] = [
  "Are you sleeping well? That's the secret to solidifying your workout gains.",
  "Progress on skills by making each rep harder, not just adding reps: slower tempo, longer holds, or a tougher leverage.",
  "Grease the groove — practise a hard skill often with fresh, sub-maximal sets. Frequency builds strength faster than grinding to failure.",
  "Log every set. What gets measured gets progressed — next time, aim to beat one number.",
  "Full range of motion first, extra reps second. Deeper reps build more strength and mobility than shallow ones.",
  "Rest fully between hard skill sets (3-5 min). Strength work rewards quality, not breathlessness.",
  "Warm the exact joints you're about to load — wrists before handstands, shoulders before pulls.",
  "Struggling to add a rep? Check out the different progression methods in your workout logger.",
  "Deload on purpose every few weeks. Backing off lets adaptations surface — you come back stronger, not weaker.",
  "Straight-arm strength (planche, front lever) needs patient, frequent, low-rep practice. Protect your elbows: build slowly.",
  "Consistency beats intensity. Three focused sessions every week for months outperforms the occasional brutal one.",
  "Train the antagonist. Balance your pulls with pushes to keep shoulders healthy and progress unbroken.",
  "Own the hold before you chase the rep. A clean 5-second tuck planche beats a wobbly 1-second full one.",
  "Sleep and food are training too. Strength is built while you recover, not only while you sweat.",
  "Fix your hollow body. A tight core turns wasted effort into clean, powerful reps on almost every movement.",
  "Small daily wins compound. One extra second of hold or one cleaner rep, repeated, becomes a skill.",
];

/**
 * `seed` is computed on the server (days since the epoch) and passed in, so
 * the same tip renders on server and client. A small integer hash spreads the
 * daily pick around the list instead of stepping through it in order.
 */
export function TrainingTip({ seed }: { seed: number }) {
  const scrambled = Math.abs((seed * 2654435761) % TIPS.length);
  const tip = TIPS[scrambled];

  return (
    <div className="flex items-start gap-3 rounded-2xl bg-primary/5 p-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Lightbulb className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          Training tip
        </p>
        <p className="mt-0.5 text-sm leading-snug">{tip}</p>
      </div>
    </div>
  );
}
