"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

type Theme = "system" | "light" | "dark";

const STORAGE_KEY = "strong-journal-theme";
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function getSnapshot(): Theme {
  return (localStorage.getItem(STORAGE_KEY) as Theme) ?? "system";
}
// Server render shows the neutral state; the client corrects after mount.
function getServerSnapshot(): Theme | null {
  return null;
}

function apply(theme: Theme) {
  const dark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

export function ThemePicker() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Follow OS changes while in system mode.
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  function pick(next: Theme) {
    localStorage.setItem(STORAGE_KEY, next);
    apply(next);
    listeners.forEach((l) => l());
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          aria-pressed={theme === value}
          onClick={() => pick(value)}
          className={cn(
            "flex min-h-11 items-center justify-center gap-2 rounded-lg border text-sm font-medium transition-colors",
            theme === value
              ? "border-primary bg-primary/10 text-foreground"
              : "text-muted-foreground hover:border-foreground/30",
          )}
        >
          <Icon className="size-4" /> {label}
        </button>
      ))}
    </div>
  );
}
