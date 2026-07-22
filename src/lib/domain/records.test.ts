import { describe, expect, it } from "vitest";
import {
  buildExerciseRecords,
  formatBest,
} from "@/lib/domain/history";
import type {
  Exercise,
  ExerciseNote,
  PerformedSet,
  WorkoutSession,
} from "@/lib/domain/schemas";

// --- Fixtures --------------------------------------------------------------

function progression(
  id: string,
  name: string,
  order: number,
  measurement: "reps" | "seconds" | "minutes" = "reps",
) {
  return { id, name, order, description: "", measurement };
}

/** Pull-up: five progressions ending in the weighted variant (as in seed). */
const pullUp: Exercise = {
  id: "pull-up",
  title: "Pull-up",
  category: "pull",
  attribute: "strength",
  measurement: "reps",
  repStyle: "standard",
  progressions: [
    progression("pull-up-p0", "Band-assisted", 0),
    progression("pull-up-p1", "Negatives", 1),
    progression("pull-up-p2", "Full pull-up", 2),
    progression("pull-up-p3", "Chest-to-bar", 3),
    progression("pull-up-p4", "Weighted", 4),
  ],
};

/** A skill hold, measured in seconds. */
const frontLever: Exercise = {
  id: "front-lever",
  title: "Front Lever",
  category: "pull",
  attribute: "skill",
  measurement: "seconds",
  repStyle: "standard",
  progressions: [
    progression("front-lever-p0", "Tuck", 0, "seconds"),
    progression("front-lever-p1", "Advanced tuck", 1, "seconds"),
  ],
};

/** A warm-up — should never appear in the records (skill/strength only). */
const scapPulls: Exercise = {
  id: "scap-pulls",
  title: "Scapula Pulls",
  category: "pull",
  attribute: "warmup",
  measurement: "reps",
  repStyle: "standard",
  progressions: [progression("scap-pulls-p0", "Two-arm", 0)],
};

function sets(
  values: Array<[reps: number | null, weight?: number]>,
): PerformedSet[] {
  return values.map(([reps, weight]) => ({ reps, weight }));
}

function session(
  id: string,
  date: string,
  entries: WorkoutSession["entries"],
): WorkoutSession {
  return {
    id,
    runId: "run-1",
    userId: "u1",
    date,
    weekIndex: 0,
    weekday: "mon",
    status: "completed",
    entries,
  };
}

// --- Tests -----------------------------------------------------------------

describe("buildExerciseRecords", () => {
  it("shows every trained progression as its own record, hiding untrained ones", () => {
    const completed = [
      session("s1", "2026-01-01", [
        {
          workoutExerciseId: "we1",
          exerciseId: "pull-up",
          progressionId: "pull-up-p2", // Full pull-up
          performedSets: sets([[10], [8], [12]]),
        },
        {
          workoutExerciseId: "we2",
          exerciseId: "pull-up",
          progressionId: "pull-up-p4", // Weighted
          performedSets: sets([
            [5, 15],
            [6, 10],
          ]),
        },
      ]),
    ];

    const [group] = buildExerciseRecords([pullUp], completed, []);
    expect(group.title).toBe("Pull-up");
    // Only the two trained progressions appear — Band-assisted, Negatives,
    // Chest-to-bar were never logged.
    expect(group.records.map((r) => r.name)).toEqual([
      "Full pull-up",
      "Weighted",
    ]);
  });

  it("ranks weighted sets by heaviest load, not by rep count", () => {
    // The exact scenario from the request: 12 bodyweight reps must NOT
    // outrank 15 kg × 5 for the Weighted progression.
    const completed = [
      session("s1", "2026-01-01", [
        {
          workoutExerciseId: "we1",
          exerciseId: "pull-up",
          progressionId: "pull-up-p4",
          performedSets: sets([
            [12, 0], // heavy volume, no load
            [5, 15], // the real PR
            [6, 10],
          ]),
        },
      ]),
    ];

    const [group] = buildExerciseRecords([pullUp], completed, []);
    const weighted = group.records.find((r) => r.name === "Weighted");
    expect(weighted?.best).toBe("15 kg × 5");
    // Level reflects position in the full 5-step ladder.
    expect(weighted?.level).toBe(5);
    expect(weighted?.totalLevels).toBe(5);
  });

  it("keeps max reps for a bodyweight-only progression", () => {
    const completed = [
      session("s1", "2026-01-01", [
        {
          workoutExerciseId: "we1",
          exerciseId: "pull-up",
          progressionId: "pull-up-p2",
          performedSets: sets([[10], [12], [8]]),
        },
      ]),
    ];
    const [group] = buildExerciseRecords([pullUp], completed, []);
    expect(group.records[0].best).toBe("12 reps");
  });

  it("normalizes holds logged in different units and formats m:ss", () => {
    const completed = [
      session("s1", "2026-01-01", [
        {
          workoutExerciseId: "we1",
          exerciseId: "front-lever",
          progressionId: "front-lever-p0",
          measurement: "minutes", // logged 1.5 min this session
          performedSets: sets([[1.5]]),
        },
      ]),
      session("s2", "2026-01-02", [
        {
          workoutExerciseId: "we2",
          exerciseId: "front-lever",
          progressionId: "front-lever-p0",
          performedSets: sets([[80]]), // 80s in the progression's own unit
        },
      ]),
    ];
    const [group] = buildExerciseRecords([frontLever], completed, []);
    // 1.5 min = 90s beats 80s → shown as 1:30.
    expect(group.records[0].best).toBe("1:30");
  });

  it("attaches the remembered note to its progression", () => {
    const completed = [
      session("s1", "2026-01-01", [
        {
          workoutExerciseId: "we1",
          exerciseId: "pull-up",
          progressionId: "pull-up-p4",
          performedSets: sets([[5, 15]]),
        },
      ]),
    ];
    const notes: ExerciseNote[] = [
      {
        userId: "u1",
        exerciseId: "pull-up",
        progressionId: "pull-up-p4",
        note: "Belt, add 2.5 kg jumps",
        updatedAt: "2026-01-01",
      },
    ];
    const [group] = buildExerciseRecords([pullUp], completed, notes);
    expect(group.records[0].note).toBe("Belt, add 2.5 kg jumps");
  });

  it("excludes warm-up/other attributes and exercises with no trained progression", () => {
    const completed = [
      session("s1", "2026-01-01", [
        {
          workoutExerciseId: "we1",
          exerciseId: "scap-pulls",
          progressionId: "scap-pulls-p0",
          performedSets: sets([[10]]),
        },
      ]),
    ];
    // Pull-up defined but never trained, scap-pulls trained but a warm-up.
    const groups = buildExerciseRecords([pullUp, scapPulls], completed, []);
    expect(groups).toEqual([]);
  });
});

describe("formatBest", () => {
  it("formats reps, holds and weighted sets", () => {
    expect(formatBest(12, "reps", 0)).toBe("12 reps");
    expect(formatBest(5, "reps", 15)).toBe("15 kg × 5");
    expect(formatBest(45, "seconds", 0)).toBe("45s");
    expect(formatBest(90, "seconds", 0)).toBe("1:30");
    expect(formatBest(1.5, "minutes", 0)).toBe("1:30");
    expect(formatBest(30, "seconds", 10)).toBe("10 kg × 30s");
  });
});
