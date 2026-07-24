import { describe, expect, it } from "vitest";
import { Exercise, PerformedSet, WorkoutSession } from "./schemas";
import { Attribute, Category } from "./types";
import { buildWeeklyVolume } from "./volume";

const TODAY = "2026-07-24"; // a Friday; its Monday is 2026-07-20

function exercise(
  id: string,
  category: Category,
  attribute: Attribute = "strength",
): Exercise {
  return {
    id,
    title: id,
    // Category is strength-only, matching the real invariant — a non-strength
    // exercise never carries one, so it can't be bucketed.
    category: attribute === "strength" ? category : undefined,
    attribute,
    measurement: "reps",
    repStyle: "standard",
    progressions: [{ id: `${id}-p`, name: "p", order: 0, description: "" }],
  };
}

/** A completed session on `date` with one entry per (exercise, sets) pair. */
function session(
  date: string,
  entries: Array<[exerciseId: string, sets: PerformedSet[]]>,
): WorkoutSession {
  return {
    id: `s-${date}-${entries.length}`,
    runId: "run",
    userId: "u",
    date,
    weekIndex: 0,
    weekday: "mon",
    status: "completed",
    entries: entries.map(([exerciseId, performedSets]) => ({
      workoutExerciseId: `we-${exerciseId}`,
      exerciseId,
      progressionId: `${exerciseId}-p`,
      performedSets,
    })),
  };
}

const done = (n: number): PerformedSet[] =>
  Array.from({ length: n }, () => ({ reps: 8 }));

const library = [
  exercise("dip", "push"),
  exercise("row", "pull"),
  exercise("squat", "legs"),
  exercise("plank", "both"),
  exercise("shoulder-circles", "both", "warmup"),
];

describe("buildWeeklyVolume", () => {
  it("counts sets per pattern into the week that contains the date", () => {
    const weeks = buildWeeklyVolume(
      [
        session("2026-07-22", [
          ["dip", done(3)],
          ["row", done(4)],
        ]),
        session("2026-07-20", [["squat", done(2)]]),
      ],
      library,
      TODAY,
    );

    expect(weeks[0].weekStart).toBe("2026-07-20");
    expect(weeks[0].sets).toEqual({ push: 3, pull: 4, both: 0, legs: 2 });
    expect(weeks[0].total).toBe(9);
    expect(weeks[0].workouts).toBe(2);
  });

  it("returns the window newest first, with empty weeks kept", () => {
    const weeks = buildWeeklyVolume([], library, TODAY, 3);
    expect(weeks.map((w) => w.weekStart)).toEqual([
      "2026-07-20",
      "2026-07-13",
      "2026-07-06",
    ]);
    expect(weeks.every((w) => w.total === 0 && w.workouts === 0)).toBe(true);
  });

  it("separates weeks and drops sessions older than the window", () => {
    const weeks = buildWeeklyVolume(
      [
        session("2026-07-21", [["dip", done(3)]]),
        session("2026-07-14", [["dip", done(5)]]),
        session("2026-05-04", [["dip", done(9)]]), // 11 weeks back
      ],
      library,
      TODAY,
    );

    expect(weeks[0].sets.push).toBe(3);
    expect(weeks[1].sets.push).toBe(5);
    expect(weeks.reduce((n, w) => n + w.total, 0)).toBe(8);
  });

  it("ignores uncategorised (non-strength) work, unrecorded and zeroed sets", () => {
    const weeks = buildWeeklyVolume(
      [
        session("2026-07-21", [
          ["shoulder-circles", done(4)],
          ["dip", [{ reps: 8 }, { reps: null }, { reps: 0 }]],
        ]),
      ],
      library,
      TODAY,
    );

    expect(weeks[0].sets).toEqual({ push: 1, pull: 0, both: 0, legs: 0 });
    // The warm-up still came from a workout that happened.
    expect(weeks[0].workouts).toBe(1);
  });

  it("skips entries whose exercise has left the library", () => {
    const weeks = buildWeeklyVolume(
      [session("2026-07-21", [["deleted", done(3)]])],
      library,
      TODAY,
    );
    expect(weeks[0].total).toBe(0);
  });
});
