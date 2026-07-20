"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, PauseCircle } from "lucide-react";
import { abandonRun } from "@/lib/actions/runs";
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

/**
 * Take an active run off the home page without touching its history.
 * abandonRun flips the run to "abandoned" and clears its remaining planned
 * sessions, so the program stops showing on the dashboard; completed workouts
 * stay in history and the program can be started again anytime.
 */
export function DeactivateRunButton({ runId }: { runId: string }) {
  const [open, setOpen] = useState(false);
  // abandonRun revalidates in place (no redirect), so just close the dialog.
  const deactivateMutation = useMutation({
    mutationFn: () => abandonRun(runId),
    onSuccess: () => setOpen(false),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <PauseCircle className="size-4" /> Stop following
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Stop following this program?</DialogTitle>
          <DialogDescription>
            It’ll be removed from your home page. Your completed workouts and
            exercise history are kept — you can start it again whenever you’re
            ready.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="destructive"
            disabled={deactivateMutation.isPending}
            onClick={() => deactivateMutation.mutate()}
          >
            {deactivateMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Stop following"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
