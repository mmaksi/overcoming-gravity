"use client";

import { useEffect, useState } from "react";
import {
  keepAwakeEnabled,
  setKeepAwakeEnabled,
} from "@/components/workout/rest-alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

/**
 * Device-level controls for the rest-timer alert: permission to notify at all,
 * and whether the app may hold itself awake so the alert can land while the
 * phone is on something else. Both are properties of this phone rather than of
 * the account, so both live in the browser, not the database.
 */
export function RestAlerts() {
  // null until mounted — permission and the preference are client-only, and
  // the server has no way to guess either.
  const [permission, setPermission] = useState<NotificationPermission | null>(
    null,
  );
  const [supported, setSupported] = useState(true);
  const [keepAwake, setKeepAwake] = useState(true);

  // Mount-only read of two browser-owned facts. The server render can't know
  // either, so correcting them after hydration is the intent, not a cascade.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const has = typeof Notification !== "undefined";
    setSupported(has);
    if (has) setPermission(Notification.permission);
    setKeepAwake(keepAwakeEnabled());
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function ask() {
    try {
      setPermission(await Notification.requestPermission());
    } catch {
      // Denied by policy, or not available outside an installed app.
    }
  }

  return (
    <div className="space-y-4">
      {!supported ? (
        <p className="text-sm text-muted-foreground">
          This browser can&apos;t show notifications. On iPhone, add Strong
          Journal to your Home Screen and open it from there.
        </p>
      ) : permission === "denied" ? (
        <p className="text-sm text-muted-foreground">
          Notifications are blocked for Strong Journal. Turn them back on in
          your phone&apos;s notification settings.
        </p>
      ) : permission === "default" ? (
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <Label>Rest-timer alerts</Label>
            <p className="text-sm text-muted-foreground">
              Get told the moment a rest period is over.
            </p>
          </div>
          <Button type="button" size="sm" onClick={ask}>
            Allow
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Rest-timer alerts are on.
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <Label htmlFor="keep-awake">Alert me while the app is closed</Label>
          <p className="text-sm text-muted-foreground">
            Keeps the timer running when you switch apps or lock the phone. Your
            phone gives audio to one app at a time, so this pauses music
            you&apos;re playing for the length of each rest.
          </p>
        </div>
        <Switch
          id="keep-awake"
          checked={keepAwake}
          onCheckedChange={(checked) => {
            setKeepAwake(checked);
            setKeepAwakeEnabled(checked);
          }}
        />
      </div>
    </div>
  );
}
