"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Check, CloudUpload, Loader2 } from "lucide-react";
import { updateName } from "@/lib/actions/settings";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SaveState = "idle" | "dirty" | "saving" | "saved";

/**
 * Name field with debounced autosave — no Save button. The write fires ~800ms
 * after the user stops typing (and never for an empty or unchanged name).
 */
export function NameForm({ initialName }: { initialName: string }) {
  const [name, setName] = useState(initialName);
  const [state, setState] = useState<SaveState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(initialName);
  const savedValue = useRef(initialName.trim());

  const saveMutation = useMutation({
    mutationFn: (value: string) => updateName(value),
    onMutate: () => setState("saving"),
    onSuccess: (_r, value) => {
      savedValue.current = value;
      setState("saved");
    },
    onError: () => setState("dirty"),
  });

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function onChange(value: string) {
    setName(value);
    latest.current = value;
    if (timer.current) clearTimeout(timer.current);
    const trimmed = value.trim();
    if (!trimmed || trimmed === savedValue.current) {
      setState("idle");
      return;
    }
    setState("dirty");
    timer.current = setTimeout(() => {
      const next = latest.current.trim();
      if (next && next !== savedValue.current) saveMutation.mutate(next);
      else setState("idle");
    }, 800);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="display-name">Your name</Label>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          {state === "saving" && (
            <>
              <Loader2 className="size-3 animate-spin" /> Saving…
            </>
          )}
          {state === "dirty" && (
            <>
              <CloudUpload className="size-3" /> Unsaved…
            </>
          )}
          {state === "saved" && (
            <>
              <Check className="size-3 text-primary" /> Saved
            </>
          )}
        </span>
      </div>
      <Input
        id="display-name"
        value={name}
        maxLength={60}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
