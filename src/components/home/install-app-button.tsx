"use client";

import { useState, useSyncExternalStore } from "react";
import { Download, EllipsisVertical, Share, SquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

declare global {
  interface Window {
    /** Stashed by InstallPromptScript before hydration. */
    caliInstallPrompt?: BeforeInstallPromptEvent;
  }
}

function isStandalone() {
  if (typeof window === "undefined") return false;

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator &&
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true)
  );
}

function isIOS() {
  if (typeof window === "undefined") return false;
  return (
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    // iPadOS reports itself as a Mac, but Macs don't have touch screens.
    (navigator.userAgent.includes("Mac") && navigator.maxTouchPoints > 1)
  );
}

function subscribeToInstallStatus(callback: () => void) {
  window.addEventListener("appinstalled", callback);
  window.addEventListener("cali-install-ready", callback);
  return () => {
    window.removeEventListener("appinstalled", callback);
    window.removeEventListener("cali-install-ready", callback);
  };
}

export function InstallAppButton() {
  const [helpOpen, setHelpOpen] = useState(false);
  const isInstalled = useSyncExternalStore(
    subscribeToInstallStatus,
    isStandalone,
    () => false, // assume browser tab on the server; standalone hides post-hydration
  );
  // The prompt event is stashed on window by InstallPromptScript (it fires
  // before hydration, so a listener attached here would miss it).
  const installPrompt = useSyncExternalStore(
    subscribeToInstallStatus,
    () => window.caliInstallPrompt ?? null,
    () => null,
  );

  async function install() {
    if (installPrompt) {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      // A used prompt can't be reused — drop it (Chrome may fire a fresh
      // beforeinstallprompt later, which the head script will re-stash).
      window.caliInstallPrompt = undefined;
      window.dispatchEvent(new Event("cali-install-ready"));
      return;
    }
    // No native prompt (iOS, or the browser hasn't offered one): show steps.
    setHelpOpen(true);
  }

  if (isInstalled) return null;

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        onClick={install}
      >
        <Download className="size-4" />
        Install app
      </Button>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Install Cali Pro</DialogTitle>
            <DialogDescription>
              Add the app to your home screen for the full experience — it
              opens full-screen and rest notifications work in the background.
            </DialogDescription>
          </DialogHeader>
          {isIOS() ? (
            <ol className="space-y-3 text-sm">
              <li className="flex items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted font-semibold">
                  1
                </span>
                <span>
                  Tap the <Share className="inline size-4" aria-hidden />{" "}
                  <strong>Share</strong> button in Safari&apos;s toolbar.
                </span>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted font-semibold">
                  2
                </span>
                <span>
                  Scroll down and tap{" "}
                  <SquarePlus className="inline size-4" aria-hidden />{" "}
                  <strong>Add to Home Screen</strong>.
                </span>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted font-semibold">
                  3
                </span>
                <span>
                  Tap <strong>Add</strong> — Cali Pro appears on your home
                  screen.
                </span>
              </li>
            </ol>
          ) : (
            <ol className="space-y-3 text-sm">
              <li className="flex items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted font-semibold">
                  1
                </span>
                <span>
                  Open the browser menu{" "}
                  <EllipsisVertical className="inline size-4" aria-hidden />{" "}
                  (or look for an install icon in the address bar).
                </span>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted font-semibold">
                  2
                </span>
                <span>
                  Tap <strong>Add to Home screen</strong> /{" "}
                  <strong>Install app</strong>.
                </span>
              </li>
            </ol>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
