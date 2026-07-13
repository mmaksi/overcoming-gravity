"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { updateAvatar } from "@/lib/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserAvatar } from "@/components/home/user-avatar";

export function AvatarForm({
  name,
  initialAvatarUrl,
}: {
  name: string;
  initialAvatarUrl?: string;
}) {
  const [url, setUrl] = useState(initialAvatarUrl ?? "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function save() {
    setSaved(false);
    setError(null);
    startTransition(async () => {
      try {
        await updateAvatar(url.trim());
        setSaved(true);
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Enter a valid image URL, or clear it",
        );
      }
    });
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="avatar-url">Profile picture</Label>
      <div className="flex items-center gap-3">
        <UserAvatar name={name} avatarUrl={url.trim() || undefined} />
        <Input
          id="avatar-url"
          type="url"
          inputMode="url"
          placeholder="https://… (leave blank to remove)"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setSaved(false);
          }}
        />
        <Button className="shrink-0" disabled={pending} onClick={save}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : "Save"}
        </Button>
      </div>
      {saved && (
        <p className="flex items-center gap-1 text-sm text-primary">
          <Check className="size-4" /> Profile picture updated
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
