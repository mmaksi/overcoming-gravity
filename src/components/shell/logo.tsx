import { cn } from "@/lib/utils";

/**
 * The Strong Journal brand mark. Theme-aware: `logo-light.png` (dark figure) shows on
 * light backgrounds, `logo-dark.png` (light figure) on dark ones — swapped by
 * the `.dark` class the theme script sets on <html>. `className` sizes it
 * (e.g. `size-20`); only the matching variant is ever displayed.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <>
      {/* `shrink-0` guards against Tailwind's base `max-width:100%` collapsing
          the mark to zero width inside a flex/grid parent with indefinite
          width. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logos/logo-light.png"
        alt="Strong Journal"
        className={cn("shrink-0 object-contain dark:hidden", className)}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logos/logo-dark.png"
        alt="Strong Journal"
        className={cn("hidden shrink-0 object-contain dark:block", className)}
      />
    </>
  );
}
