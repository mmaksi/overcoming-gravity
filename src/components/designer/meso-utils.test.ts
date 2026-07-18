import { describe, expect, it } from "vitest";
import { Mesocycle, WorkoutDay } from "@/lib/domain/schemas";
import {
  cloneDay,
  copyDayToDays,
  copyWeekToWeeks,
  groupExercises,
} from "./meso-utils";

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

describe("groupExercises", () => {
  it("stores the mode's config on the group", () => {
    const result = groupExercises(day("x"), ["x"], "hiit", {
      workSeconds: 30,
      restSeconds: 30,
      rounds: 8,
    });
    expect(result.groups).toEqual([
      expect.objectContaining({
        type: "hiit",
        workSeconds: 30,
        restSeconds: 30,
        rounds: 8,
      }),
    ]);
  });

  it("dissolves a group left below its mode's minimum size", () => {
    const base: WorkoutDay = {
      groups: [],
      exercises: [
        { ...day("a").exercises[0], id: "a" },
        { ...day("b").exercises[0], id: "b" },
      ],
    };
    const paired = groupExercises(base, ["a", "b"], "superset", {
      restSeconds: 90,
    });
    // pulling one exercise into its own mode leaves a 1-member superset,
    // which is meaningless — it must dissolve
    const result = groupExercises(paired, ["a"], "to_failure");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].type).toBe("to_failure");
    const b = result.exercises.find((we) => we.id === "b")!;
    expect(b.groupId).toBeUndefined();
  });

  it("pyramid steps become the exercise's set count and step rest its rest", () => {
    const result = groupExercises(day("x"), ["x"], "pyramid", {
      steps: 5,
      restSeconds: 60,
    });
    const we = result.exercises[0];
    expect(we.sets).toHaveLength(5);
    // existing set targets are kept, the rest pad out from the last one
    expect(we.sets.map((s) => s.reps)).toEqual([5, 4, 4, 4, 4]);
    expect(we.restSeconds).toBe(60);
    expect(we.groupId).toBe(result.groups[0].id);
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
