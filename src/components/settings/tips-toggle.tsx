"use client";

import { useState, useTransition } from "react";
import { setShowTips } from "@/lib/actions/settings";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

/**
 * Re-enable the in-app tips: the welcome tour (next visit to home) and the
 * workout-designer intro (next visit to the designer). On while either tip
 * is still pending; switching writes both flags together.
 */
export function TipsToggle({ initialShow }: { initialShow: boolean }) {
  const [show, setShow] = useState(initialShow);
  const [, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="space-y-0.5">
        <Label htmlFor="tips-toggle">Show in-app tips</Label>
        <p className="text-sm text-muted-foreground">
          See the app tour and the workout-designer intro again.
        </p>
      </div>
      <Switch
        id="tips-toggle"
        checked={show}
        onCheckedChange={(checked) => {
          setShow(checked);
          startTransition(() => setShowTips(checked));
        }}
      />
    </div>
  );
}
