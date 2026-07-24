import { describe, expect, it } from "vitest";
import { mergeDraftEntries } from "./session-storage";
import type { EntryState } from "./logging-types";

function entry(id: string, reps: string[] = []): EntryState {
  return {
    workoutExerciseId: id,
    exerciseId: `ex-${id}`,
    progressionId: `prog-${id}`,
    sets: reps.map((r) => ({
      reps: r,
      weight: "",
      done: r !== "",
      parts: [{ progressionId: `prog-${id}`, reps: "" }],
      eccentricReps: "",
    })),
  };
}

describe("mergeDraftEntries", () => {
  it("takes what the athlete logged over the plan's empty seed", () => {
    const merged = mergeDraftEntries(
      [entry("a", ["", ""])],
      [entry("a", ["8", "6"])],
    );
    expect(merged[0].sets.map((s) => s.reps)).toEqual(["8", "6"]);
  });

  it("keeps the plan's order and length, not the draft's", () => {
    const merged = mergeDraftEntries(
      [entry("a"), entry("b"), entry("c")],
      [entry("c", ["5"]), entry("a", ["9"])],
    );
    expect(merged.map((e) => e.workoutExerciseId)).toEqual(["a", "b", "c"]);
  });

  it("drops draft entries for exercises no longer in the plan", () => {
    const merged = mergeDraftEntries([entry("a")], [entry("gone", ["10"])]);
    expect(merged).toHaveLength(1);
    expect(merged[0].workoutExerciseId).toBe("a");
    expect(merged[0].sets).toEqual([]);
  });

  it("seeds exercises added to the plan since the draft was written", () => {
    const merged = mergeDraftEntries(
      [entry("a", [""]), entry("new", ["", ""])],
      [entry("a", ["12"])],
    );
    expect(merged[1].workoutExerciseId).toBe("new");
    expect(merged[1].sets.map((s) => s.reps)).toEqual(["", ""]);
  });

  it("ignores a malformed draft entry rather than logging it", () => {
    const broken = { workoutExerciseId: "a" } as unknown as EntryState;
    const merged = mergeDraftEntries([entry("a", ["7"])], [broken]);
    expect(merged[0].sets.map((s) => s.reps)).toEqual(["7"]);
  });

  it("carries a progression swapped mid-workout back from the draft", () => {
    const drafted = { ...entry("a", ["8"]), progressionId: "swapped" };
    const merged = mergeDraftEntries([entry("a", [""])], [drafted]);
    expect(merged[0].progressionId).toBe("swapped");
  });
});
