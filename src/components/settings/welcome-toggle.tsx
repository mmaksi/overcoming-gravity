"use client";

import { useState, useTransition } from "react";
import { setShowWelcome } from "@/lib/actions/settings";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

/** Re-enable the welcome tour: it shows again on the next visit to home. */
export function WelcomeToggle({ initialShow }: { initialShow: boolean }) {
  const [show, setShow] = useState(initialShow);
  const [, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="space-y-0.5">
        <Label htmlFor="welcome-toggle">Show the welcome tour</Label>
        <p className="text-sm text-muted-foreground">
          See the app tour again on your next visit.
        </p>
      </div>
      <Switch
        id="welcome-toggle"
        checked={show}
        onCheckedChange={(checked) => {
          setShow(checked);
          startTransition(() => setShowWelcome(checked));
        }}
      />
    </div>
  );
}
