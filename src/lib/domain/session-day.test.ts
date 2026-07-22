import { describe, expect, it } from "vitest";
import {
  sessionWorkoutDay,
  WorkoutDay,
  WorkoutSession,
} from "./schemas";

/**
 * Regression for the history-divergence bug: a completed session must render
 * from its own entries, not the live plan. The plan below has been edited
 * since the workout was logged — the strength pull-up now carries a hybrid
 * technique and, like every exercise, a freshly generated workout-exercise id,
 * so nothing matches the stored entries by id. (Mirrors the real data:
 * stored pull-up-p2 = 15 kg × 4, plan pull-up-p2 = hybrid, 3 × 8.)
 */
const editedPlan: WorkoutDay = {
  exercises: [
    {
      id: "plan-hang", // stored entry's id was "snap-hang"
      exerciseId: "pull-up",
      progressionId: "pull-up-p0",
      sets: [{ reps: 60 }],
      restSeconds: 60,
      progressionMethod: "intra",
      measurement: "seconds",
      section: "warmup",
    },
    {
      id: "plan-pullup", // stored entry's id was "snap-pullup"
      exerciseId: "pull-up",
      progressionId: "pull-up-p2",
      sets: [{ reps: 8 }, { reps: 8 }, { reps: 8 }],
      restSeconds: 90,
      progressionMethod: "intra",
      interTechniqueId: "hybrid", // added after the workout was completed
      section: "strength",
    },
  ],
  groups: [],
};

const session: WorkoutSession = {
  id: "s1",
  runId: "r1",
  userId: "u1",
  date: "2026-07-21",
  weekIndex: 2,
  weekday: "tue",
  status: "completed",
  entries: [
    {
      workoutExerciseId: "snap-hang",
      exerciseId: "pull-up",
      progressionId: "pull-up-p0",
      measurement: "seconds",
      performedSets: [{ reps: 60 }],
    },
    {
      workoutExerciseId: "snap-pullup",
      exerciseId: "pull-up",
      progressionId: "pull-up-p2",
      performedSets: [
        { reps: 3, weight: 15 },
        { reps: 4, weight: 15 },
      ],
    },
  ],
};

describe("sessionWorkoutDay", () => {
  it("reconstructs a recorded day from its entries, not the since-edited plan", () => {
    const day = sessionWorkoutDay(session, editedPlan);

    // One exercise per entry, carrying the stored ids (so the logger's overlay
    // matches and shows the performed sets).
    expect(day.exercises.map((we) => we.id)).toEqual(["snap-hang", "snap-pullup"]);

    const pullup = day.exercises[1];
    expect(pullup.exerciseId).toBe("pull-up");
    expect(pullup.progressionId).toBe("pull-up-p2");
    // The plan's later-added hybrid technique must NOT leak onto history.
    expect(pullup.interTechniqueId).toBeUndefined();
    // Set count mirrors what was performed (2 weighted sets), not the plan's 3.
    expect(pullup.sets).toHaveLength(2);

    // The unit the athlete actually logged the hang in is preserved.
    expect(day.exercises[0].measurement).toBe("seconds");
  });

  it("keeps the entry's own technique/unit even when the plan id still matches", () => {
    // Same ids on both sides, but the plan disagrees with what was performed.
    const plan: WorkoutDay = {
      exercises: [
        {
          id: "we1",
          exerciseId: "pull-up",
          progressionId: "pull-up-p0", // plan says p0
          sets: [{ reps: 8 }],
          restSeconds: 120,
          progressionMethod: "intra",
          interTechniqueId: "hybrid", // plan says hybrid
        },
      ],
      groups: [],
    };
    const s: WorkoutSession = {
      ...session,
      entries: [
        {
          workoutExerciseId: "we1",
          exerciseId: "pull-up",
          progressionId: "pull-up-p2", // performed p2
          performedSets: [{ reps: 5, weight: 20 }],
        },
      ],
    };
    const [we] = sessionWorkoutDay(s, plan).exercises;
    expect(we.progressionId).toBe("pull-up-p2"); // performed wins
    expect(we.interTechniqueId).toBeUndefined(); // no technique was performed
    expect(we.restSeconds).toBe(120); // cosmetic plan field still enriches
  });

  it("works with no plan at all (plan deleted or day reshaped)", () => {
    const day = sessionWorkoutDay(session, undefined);
    expect(day.exercises).toHaveLength(2);
    expect(day.exercises[1].progressionId).toBe("pull-up-p2");
    expect(day.exercises[1].restSeconds).toBe(90); // default
  });
});
