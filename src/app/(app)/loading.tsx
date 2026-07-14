import { Logo } from "@/components/shell/logo";

/**
 * Branded splash shown while an app route loads. With the long router-cache
 * window this mainly appears on the cold load of the home screen, giving the
 * app a proper launch moment.
 */
export default function Loading() {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center">
      <Logo className="size-24 animate-pulse" />
    </div>
  );
}
