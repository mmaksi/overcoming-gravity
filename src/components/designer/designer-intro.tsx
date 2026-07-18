"use client";

import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  Dumbbell,
  GripVertical,
  Layers,
  ListChecks,
  Trash2,
} from "lucide-react";
import { setShowDesignerIntro } from "@/lib/actions/settings";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

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
    key: "delete",
    icon: <Trash2 className="size-6" />,
    title: "Remove with the bin",
    body: "Don't want an exercise? Tap the red bin on its row. And to move between your training days, swipe sideways or use the arrows.",
  },
  {
    key: "reorder",
    icon: <GripVertical className="size-6" />,
    title: "Drag to reorder",
    body: "Hold an exercise by its grip handle and drag it to change the order within its section.",
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
 * Shown while the profile's showDesignerIntro flag is set; closing it in any
 * way clears the flag in the database, so it appears once per account (not
 * per device).
 */
export function DesignerIntro({ show }: { show: boolean }) {
  const [open, setOpen] = useState(show);
  const [active, setActive] = useState(0);
  const touchStartX = useRef<number | null>(null);

  // Fire-and-forget: the dialog closes immediately; a failed write just means
  // the intro shows again next visit, which is harmless.
  const dismissMutation = useMutation({
    mutationFn: () => setShowDesignerIntro(false),
  });

  function handleOpenChange(next: boolean) {
    if (!next && open) dismissMutation.mutate();
    setOpen(next);
  }

  function goTo(index: number) {
    setActive(Math.max(0, Math.min(SLIDES.length - 1, index)));
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

        <div
          className="space-y-3 py-2 text-center"
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
              onClick={() => goTo(i)}
              className={cn(
                "size-2 rounded-full transition-colors",
                i === active ? "bg-primary" : "bg-muted-foreground/30",
              )}
            />
          ))}
        </div>

        <div className="space-y-2">
          <div className="flex gap-2">
            {active > 0 && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => goTo(active - 1)}
              >
                <ArrowLeft className="size-4" /> Back
              </Button>
            )}
            {last ? (
              <Button
                className="flex-1"
                onClick={() => handleOpenChange(false)}
              >
                Start designing <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button className="flex-1" onClick={() => goTo(active + 1)}>
                Next <ArrowRight className="size-4" />
              </Button>
            )}
          </div>
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
