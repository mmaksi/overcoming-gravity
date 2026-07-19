import { Logo } from "@/components/shell/logo";

/**
 * Branded splash shown while an app route loads. With the long router-cache
 * window this mainly appears on the cold load of the home screen, giving the
 * app a proper launch moment.
 */
export default function Loading() {
  return (
    // The logo PNG carries its own whitespace, so the tiny gap keeps the
    // tagline visually attached to the mark.
    <div className="flex min-h-[80dvh] flex-col items-center justify-center gap-1 px-6 text-center">
      <Logo className="size-40 animate-pulse" />
      <p className="text-2xl font-bold tracking-tight text-foreground">
        Redefine Your Impossible
      </p>
    </div>
  );
}
