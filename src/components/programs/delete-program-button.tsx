"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import { deleteProgram } from "@/lib/actions/programs";
import { queryKeys } from "@/lib/query/keys";
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

export function DeleteProgramButton({ programId }: { programId: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();
  // Deleting a program cascades its runs' sessions out of the completed
  // history, so the client history + progress reads must refetch; then navigate
  // back to /programs on the client (the action no longer redirects).
  const deleteMutation = useMutation({
    mutationFn: () => deleteProgram(programId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.history() });
      queryClient.invalidateQueries({ queryKey: queryKeys.progress() });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="w-full text-destructive">
          <Trash2 className="size-4" /> Delete program
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this program?</DialogTitle>
          <DialogDescription>
            This removes the program, its runs and all logged workouts. This
            cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={deleteMutation.isPending}
            onClick={() =>
              deleteMutation
                .mutateAsync()
                .then(() => router.push("/programs"))
                .catch(() => undefined)
            }
          >
            {deleteMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Delete"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
