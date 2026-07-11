"use client";

import { useState, useTransition } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { resetRun } from "@/lib/actions/runs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** Restart the active run from scratch; exercise history stays intact. */
export function ResetRunButton({ runId }: { runId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <RotateCcw className="size-4" /> Reset program
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset this program?</DialogTitle>
          <DialogDescription>
            The schedule restarts from today at week 1. Only the program
            progress resets — your completed workouts, exercise history and
            bests are kept.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await resetRun(runId);
                setOpen(false);
              })
            }
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : "Reset"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
