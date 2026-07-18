"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarDays,
  Dumbbell,
  Heart,
  Loader2,
  Mail,
  Settings,
  TrendingUp,
} from "lucide-react";
import { setShowWelcome } from "@/lib/actions/settings";
import { Logo } from "@/components/shell/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const COACHING_EMAIL = "hello@freestylehuman.com";

/**
 * The welcome tour: swipeable full-width slides (CSS scroll-snap, same
 * pattern as the home run carousel) walking a new athlete through the app.
 * Dismissing it clears the profile flag, so it shows once — until the
 * athlete re-enables it in Settings.
 */
export function WelcomeCarousel({ name }: { name: string }) {
  const [active, setActive] = useState(0);
  const router = useRouter();

  // Fork rule: await the mutation, then push — navigation queued in the same
  // tick as the action's revalidation is swallowed in this Next fork.
  const dismissMutation = useMutation({
    mutationFn: () => setShowWelcome(false),
  });
  const pending = dismissMutation.isPending;

  function finish() {
    dismissMutation
      .mutateAsync()
      .then(() => router.push("/"))
      .catch(() => undefined);
  }

  const slides = [
    {
      key: "thanks",
      icon: <Heart className="size-7" />,
      title: `Thank you for joining, ${name}!`,
      body: (
        <>
          <Logo className="mx-auto size-24" />
          <p>
            Strong Journal is your home for building, tracking and progressing
            your calisthenics training. Let&apos;s take a quick look around.
          </p>
        </>
      ),
    },
    {
      key: "settings",
      icon: <Settings className="size-7" />,
      title: "Make it yours",
      body: (
        <>
          {/* TODO: replace this placeholder with the real screenshot of the
              settings gear position (top right of the home screen). */}
          <div className="mx-auto flex h-36 w-full max-w-xs items-center justify-center rounded-xl border-2 border-dashed bg-muted/50">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Settings className="size-5" /> Top right of your home screen
            </span>
          </div>
          <p>
            Head to <span className="font-semibold">Settings</span> — the gear
            icon in the top right corner — to customise your app and track
            your ideal body: weight, height and BMI.
          </p>
        </>
      ),
    },
    {
      key: "programs",
      icon: <Dumbbell className="size-7" />,
      title: "Programs & workouts",
      body: (
        <>
          <p>
            Build full training <span className="font-semibold">programs</span>{" "}
            — goals, periodization and a week-by-week plan — or quick{" "}
            <span className="font-semibold">custom workouts</span>, all from
            the Programs tab.
          </p>
          <p className="text-sm text-muted-foreground">
            Want help designing the perfect program for your goals — one that
            works around your limitations, weaknesses, strengths and
            background? Ask about private coaching:
          </p>
          <a
            href={`mailto:${COACHING_EMAIL}`}
            className="inline-flex items-center gap-2 font-medium text-primary underline underline-offset-4"
          >
            <Mail className="size-4" /> {COACHING_EMAIL}
          </a>
        </>
      ),
    },
    {
      key: "progress",
      icon: <CalendarDays className="size-7" />,
      title: "Watch yourself get stronger",
      body: (
        <>
          <p>
            The <span className="font-semibold">Calendar</span> shows the
            history of all your previous training, and the{" "}
            <span className="inline-flex items-baseline gap-1 font-semibold">
              Progress tab
              <TrendingUp className="size-4 self-center" />
            </span>{" "}
            tracks your overall progress on every exercise.
          </p>
        </>
      ),
    },
  ];

  // Swiping: a plain touch delta on the wrapper (state-driven transform
  // below). Scroll-snap was flaky here: Chromium cancels smooth programmatic
  // scrolls inside a mandatory snap container, so buttons couldn't advance it.
  const touchStartX = useRef<number | null>(null);

  function goTo(index: number) {
    setActive(Math.max(0, Math.min(slides.length - 1, index)));
  }

  const last = active === slides.length - 1;

  return (
    <div className="flex min-h-[70dvh] flex-col justify-center gap-6">
      <div
        className="-mx-4 overflow-hidden"
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          if (touchStartX.current === null) return;
          const delta = e.changedTouches[0].clientX - touchStartX.current;
          touchStartX.current = null;
          if (Math.abs(delta) > 40) goTo(active + (delta < 0 ? 1 : -1));
        }}
      >
        <div
          className="flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${active * 100}%)` }}
        >
          {slides.map((slide, i) => (
            <div
              key={slide.key}
              aria-hidden={i !== active}
              className="w-full shrink-0 space-y-4 px-6 text-center"
            >
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/15 text-primary">
                {slide.icon}
              </div>
              <h2 className="text-2xl font-bold">{slide.title}</h2>
              <div className="space-y-3 leading-relaxed">{slide.body}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-center gap-1.5">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => goTo(i)}
            className={cn(
              "size-2 rounded-full transition-colors",
              i === active ? "bg-primary" : "bg-muted-foreground/30",
            )}
          />
        ))}
      </div>

      <div className="space-y-2 px-2">
        {last ? (
          <Button className="w-full" size="lg" disabled={pending} onClick={finish}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                Start training <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        ) : (
          <Button className="w-full" size="lg" onClick={() => goTo(active + 1)}>
            Next <ArrowRight className="size-4" />
          </Button>
        )}
        {!last && (
          <Button
            variant="ghost"
            className="w-full text-muted-foreground"
            disabled={pending}
            onClick={finish}
          >
            Skip the tour
          </Button>
        )}
      </div>
    </div>
  );
}
