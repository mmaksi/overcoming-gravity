import { describe, expect, it } from "vitest";
import { Mesocycle, WorkoutDay } from "@/lib/domain/schemas";
import { cloneDay, copyDayToDays, copyWeekToWeeks } from "./meso-utils";

function day(marker: string, intensity?: "high" | "low"): WorkoutDay {
  return {
    intensity,
    groups: [],
    exercises: [
      {
        id: marker,
        exerciseId: "pull-up",
        progressionId: "pull-up-p0",
        sets: [{ reps: 5 }, { reps: 4 }],
        restSeconds: 120,
        progressionMethod: "intra",
      },
    ],
  };
}

function meso(): Mesocycle {
  return {
    weeks: [
      { index: 0, isDeload: false, days: { mon: day("a", "high"), wed: day("b", "low") } },
      { index: 1, isDeload: false, days: { mon: day("c", "high"), wed: day("d", "low") } },
      { index: 2, isDeload: true, days: { mon: day("e", "low"), wed: day("f", "low") } },
    ],
  };
}

describe("cloneDay", () => {
  it("deep-clones with fresh exercise ids", () => {
    const source = day("x");
    const copy = cloneDay(source);
    expect(copy.exercises[0].id).not.toBe(source.exercises[0].id);
    expect(copy.exercises[0].sets).toEqual(source.exercises[0].sets);
    copy.exercises[0].sets[0].reps = 99;
    expect(source.exercises[0].sets[0].reps).toBe(5);
  });
});

describe("copyDayToDays", () => {
  it("copies exercises but keeps the target day's intensity", () => {
    const result = copyDayToDays(meso(), 0, "mon", ["wed"]);
    const wed = result.weeks[0].days.wed!;
    expect(wed.exercises[0].exerciseId).toBe("pull-up");
    expect(wed.exercises[0].id).not.toBe("a");
    expect(wed.intensity).toBe("low");
  });
});

describe("copyWeekToWeeks", () => {
  it("copies all days to target weeks with fresh ids", () => {
    const result = copyWeekToWeeks(meso(), 0, [1]);
    const w1mon = result.weeks[1].days.mon!;
    expect(w1mon.exercises[0].sets).toEqual([{ reps: 5 }, { reps: 4 }]);
    expect(w1mon.exercises[0].id).not.toBe("a");
    // untouched week stays as-is
    expect(result.weeks[2].days.mon!.exercises[0].id).toBe("e");
  });

  it("preserves the deload week's own intensity tags", () => {
    const result = copyWeekToWeeks(meso(), 0, [2]);
    expect(result.weeks[2].days.mon!.intensity).toBe("low");
    expect(result.weeks[2].days.mon!.exercises[0].exerciseId).toBe("pull-up");
  });
});
