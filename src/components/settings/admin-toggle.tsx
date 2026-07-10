"use client";

import { useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { setAdminMode } from "@/lib/actions/settings";

export function AdminToggle({ isAdmin }: { isAdmin: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex items-center justify-between">
      <div>
        <Label htmlFor="admin-mode">Admin mode</Label>
        <p className="text-sm text-muted-foreground">
          Dev only: unlock the admin area to manage skills and exercises.
        </p>
      </div>
      <Switch
        id="admin-mode"
        checked={isAdmin}
        disabled={pending}
        onCheckedChange={(checked) =>
          startTransition(() => setAdminMode(checked))
        }
      />
    </div>
  );
}
