"use client";

import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Camera, Check, Loader2, Trash2 } from "lucide-react";
import { removeAvatar, uploadAvatar } from "@/lib/actions/settings";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { UserAvatar } from "@/components/home/user-avatar";

/**
 * Profile picture upload: picks a file from the device and sends it to the
 * blob store (Supabase Storage in production). The instant local preview
 * uses an object URL while the round-trip runs.
 */
export function AvatarForm({
  name,
  initialAvatarUrl,
}: {
  name: string;
  initialAvatarUrl?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: (formData: FormData) => uploadAvatar(formData),
    onSuccess: () => setSaved(true),
    onError: (e) => {
      setPreview(null);
      setError(e instanceof Error ? e.message : "Upload failed");
    },
  });
  const removeMutation = useMutation({
    mutationFn: () => removeAvatar(),
    onError: (e) =>
      setError(e instanceof Error ? e.message : "Couldn't remove"),
  });
  const pending = uploadMutation.isPending || removeMutation.isPending;

  function upload(file: File) {
    setSaved(false);
    setError(null);
    setPreview(URL.createObjectURL(file));
    const formData = new FormData();
    formData.set("avatar", file);
    uploadMutation.mutate(formData);
  }

  function remove() {
    setSaved(false);
    setError(null);
    setPreview(null);
    removeMutation.mutate();
  }

  const shownUrl = preview ?? initialAvatarUrl;

  return (
    <div className="space-y-2">
      <Label htmlFor="avatar-file">Profile picture</Label>
      <div className="flex items-center gap-3">
        <UserAvatar name={name} avatarUrl={shownUrl} />
        <input
          ref={fileRef}
          id="avatar-file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file);
            e.target.value = "";
          }}
        />
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => fileRef.current?.click()}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Camera className="size-4" />
          )}{" "}
          {shownUrl ? "Change photo" : "Upload photo"}
        </Button>
        {shownUrl && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Remove profile picture"
            className="text-muted-foreground hover:text-destructive"
            disabled={pending}
            onClick={remove}
          >
            <Trash2 className="size-5" />
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        JPEG, PNG or WebP, up to 5 MB.
      </p>
      {saved && (
        <p className="flex items-center gap-1 text-sm text-primary">
          <Check className="size-4" /> Profile picture updated
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
