"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Copy, Dumbbell, Layers, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** Shown once per device — the designer is dense on first sight. */
const SEEN_KEY = "strong-journal-designer-intro-seen";

const SLIDES = [
  {
    key: "prefilled",
    icon: <ListChecks className="size-6" />,
    title: "Workouts come pre-filled",
    body: "Every workout has sections — warm-up, skills, strength and more — with default exercises already set to save you time. Change anything you like.",
  },
  {
    key: "strength",
    icon: <Dumbbell className="size-6" />,
    title: "Set your strength work",
    body: "The strength section is yours to design: add exercises and pick the progressions that match your goals.",
  },
  {
    key: "combine",
    icon: <Layers className="size-6" />,
    title: "Combine exercises",
    body: "Select several exercises in a section to turn them into a superset, circuit or pyramid.",
  },
  {
    key: "copy",
    icon: <Copy className="size-6" />,
    title: "Copy to save time",
    body: "Design one day, then copy it to your other days — or copy a whole week to the remaining weeks.",
  },
];

/**
 * First-visit tour of the workout designer, so the page doesn't overwhelm.
 * Opens once (localStorage flag) and never again — closing it in any way
 * counts as seen.
 */
export function DesignerIntro() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  // localStorage is unreadable on the server, so the check must run
  // post-hydration; opening in an effect is intended here.
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!localStorage.getItem(SEEN_KEY)) setOpen(true);
    } catch {
      // Private mode — skip the tour rather than show it on every visit.
    }
  }, []);

  function handleOpenChange(next: boolean) {
    if (!next) {
      try {
        localStorage.setItem(SEEN_KEY, "1");
      } catch {
        // ignore
      }
    }
    setOpen(next);
  }

  const slide = SLIDES[active];
  const last = active === SLIDES.length - 1;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Designing your workouts
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary">
            {slide.icon}
          </div>
          <h2 className="text-lg font-bold">{slide.title}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {slide.body}
          </p>
        </div>

        <div className="flex justify-center gap-1.5">
          {SLIDES.map((s, i) => (
            <button
              key={s.key}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => setActive(i)}
              className={cn(
                "size-2 rounded-full transition-colors",
                i === active ? "bg-primary" : "bg-muted-foreground/30",
              )}
            />
          ))}
        </div>

        <div className="space-y-2">
          {last ? (
            <Button className="w-full" onClick={() => handleOpenChange(false)}>
              Start designing <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button className="w-full" onClick={() => setActive((a) => a + 1)}>
              Next <ArrowRight className="size-4" />
            </Button>
          )}
          {!last && (
            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={() => handleOpenChange(false)}
            >
              Skip
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
