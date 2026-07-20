"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useOptimistic,
} from "react";

/**
 * Shares the lifetime "Goals achieved" count between the Stats card and the
 * GoalsCard so ticking a goal updates both at once, optimistically. The
 * GoalsCard owns the toggle and pushes the ±1 delta here; the Stats card just
 * reads the running total. Both revert together when the revalidated dashboard
 * props arrive after the server write.
 */
type GoalsAchievedContext = {
  achieved: number;
  /** Nudge the lifetime total. Must be called inside a transition. */
  applyDelta: (delta: number) => void;
};

const Context = createContext<GoalsAchievedContext | null>(null);

export function GoalsAchievedProvider({
  initial,
  children,
}: {
  initial: number;
  children: ReactNode;
}) {
  const [achieved, applyDelta] = useOptimistic(
    initial,
    (state, delta: number) => state + delta,
  );
  return (
    <Context.Provider value={{ achieved, applyDelta }}>
      {children}
    </Context.Provider>
  );
}

/**
 * The delta dispatcher for the GoalsCard. Returns a no-op when rendered
 * outside a provider so the card still works on its own.
 */
export function useApplyGoalsAchievedDelta(): (delta: number) => void {
  return useContext(Context)?.applyDelta ?? (() => {});
}

/**
 * The lifetime count for the Stats card. Reads the shared optimistic total,
 * falling back to the server-rendered value when outside a provider (e.g. the
 * empty-state dashboard with no tickable goals).
 */
export function GoalsAchievedCount({ fallback }: { fallback: number }) {
  const ctx = useContext(Context);
  return <>{ctx?.achieved ?? fallback}</>;
}
