import { cn } from "@/lib/utils";

/**
 * The Cali Pro brand mark. Theme-aware: `logo-light.png` (dark figure) shows on
 * light backgrounds, `logo-dark.png` (light figure) on dark ones — swapped by
 * the `.dark` class the theme script sets on <html>. `className` sizes it
 * (e.g. `size-20`); only the matching variant is ever displayed.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logos/logo-light.png"
        alt="Cali Pro"
        className={cn("object-contain dark:hidden", className)}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logos/logo-dark.png"
        alt="Cali Pro"
        className={cn("hidden object-contain dark:block", className)}
      />
    </>
  );
}
