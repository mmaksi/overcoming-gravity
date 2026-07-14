"use client";

import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Camera, Check, Loader2, X } from "lucide-react";
import { removeAvatar, uploadAvatar } from "@/lib/actions/settings";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Profile picture upload. The avatar circle *is* the control: tapping it opens
 * the file picker (a camera badge sits on the circle to signal that), and a
 * small ✕ badge removes the current photo. The instant local preview uses an
 * object URL while the upload round-trips.
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
  const [broken, setBroken] = useState(false);
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
    setBroken(false);
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
  const showImage = shownUrl && !broken;

  return (
    <div className="space-y-2">
      <Label>Profile picture</Label>
      <div className="flex items-center gap-4">
        <div className="relative size-20 shrink-0">
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
          {/* The circle itself is the upload button. */}
          <button
            type="button"
            disabled={pending}
            aria-label={showImage ? "Change profile picture" : "Upload profile picture"}
            onClick={() => fileRef.current?.click()}
            className="group relative block size-20 overflow-hidden rounded-full bg-primary/15 text-2xl font-bold text-primary"
          >
            {showImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={shownUrl}
                alt={name}
                className="size-full object-cover"
                onError={() => setBroken(true)}
              />
            ) : (
              <span className="flex size-full items-center justify-center">
                {(name.trim()[0] ?? "?").toUpperCase()}
              </span>
            )}
            {/* Darken + show a camera on hover/focus (and while uploading). */}
            <span
              className={cn(
                "absolute inset-0 flex items-center justify-center bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100",
                pending && "opacity-100",
              )}
            >
              {pending ? (
                <Loader2 className="size-6 animate-spin" />
              ) : (
                <Camera className="size-6" />
              )}
            </span>
          </button>

          {/* Persistent camera badge so the affordance is obvious at rest. */}
          <span className="pointer-events-none absolute -bottom-0.5 -right-0.5 flex size-7 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground">
            <Camera className="size-3.5" />
          </span>

          {/* Remove badge, only when there's a picture to remove. */}
          {showImage && !pending && (
            <button
              type="button"
              aria-label="Remove profile picture"
              onClick={remove}
              className="absolute -right-0.5 -top-0.5 z-10 flex size-6 items-center justify-center rounded-full border-2 border-background bg-destructive text-white transition-transform hover:scale-105"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div className="min-w-0 text-sm">
          <p className="text-muted-foreground">
            Tap your photo to {showImage ? "change" : "upload"} it.
          </p>
          <p className="text-xs text-muted-foreground">
            JPEG, PNG or WebP, up to 5 MB.
          </p>
          {saved && (
            <p className="mt-1 flex items-center gap-1 text-sm text-primary">
              <Check className="size-4" /> Updated
            </p>
          )}
          {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
        </div>
      </div>
    </div>
  );
}
