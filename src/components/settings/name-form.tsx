"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { updateName } from "@/lib/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function NameForm({ initialName }: { initialName: string }) {
  const [name, setName] = useState(initialName);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function save() {
    setSaved(false);
    startTransition(async () => {
      await updateName(name.trim());
      setSaved(true);
    });
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="display-name">Your name</Label>
      <div className="flex gap-2">
        <Input
          id="display-name"
          value={name}
          maxLength={60}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
        />
        <Button
          className="shrink-0"
          disabled={pending || !name.trim() || name.trim() === initialName.trim()}
          onClick={save}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : "Save"}
        </Button>
      </div>
      {saved && (
        <p className="flex items-center gap-1 text-sm text-primary">
          <Check className="size-4" /> Name updated
        </p>
      )}
    </div>
  );
}
