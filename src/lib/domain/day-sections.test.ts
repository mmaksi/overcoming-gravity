import { describe, expect, it } from "vitest";
import {
  daySections,
  Exercise,
  normalizeWorkoutDay,
  orderDayExercises,
  WorkoutDay,
  WorkoutExercise,
} from "./schemas";

function exercise(id: string, attribute: Exercise["attribute"]): Exercise {
  return {
    id,
    title: id,
    category: "push",
    attribute,
    measurement: "reps",
    repStyle: "standard",
    progressions: [
      { id: `${id}-p1`, name: "P1", order: 0, description: "" },
    ],
  };
}

function planned(
  id: string,
  exerciseId: string,
  section?: WorkoutExercise["section"],
): WorkoutExercise {
  return {
    id,
    exerciseId,
    progressionId: `${exerciseId}-p1`,
    sets: [{ reps: 8 }],
    restSeconds: 90,
    progressionMethod: "intra",
    section,
  };
}

const catalog = new Map(
  [
    exercise("warm", "warmup"),
    exercise("skill", "skill"),
    exercise("push", "strength"),
    exercise("stretch", "flexibility"),
  ].map((e) => [e.id, e]),
);

describe("daySections / orderDayExercises", () => {
  it("buckets by section in workout order, keeping array order within a section", () => {
    // Raw array deliberately interleaved.
    const exercises = [
      planned("a", "push"),
      planned("b", "warm"),
      planned("c", "push"),
      planned("d", "warm"),
    ];
    const sections = daySections(exercises, catalog);
    expect(sections.map((s) => s.attribute)).toEqual(["warmup", "strength"]);
    expect(orderDayExercises(exercises, catalog).map((we) => we.id)).toEqual([
      "b",
      "d",
      "a",
      "c",
    ]);
  });

  it("prefers an explicit section over the catalog attribute", () => {
    // A strength exercise deliberately planned into the warm-up section.
    const exercises = [
      planned("a", "push", "warmup"),
      planned("b", "warm"),
    ];
    const sections = daySections(exercises, catalog);
    expect(sections).toHaveLength(1);
    expect(sections[0].attribute).toBe("warmup");
    expect(sections[0].exercises.map((we) => we.id)).toEqual(["a", "b"]);
  });

  it("falls back to strength for exercises missing from the catalog", () => {
    const exercises = [planned("a", "deleted-from-catalog")];
    expect(daySections(exercises, catalog)[0].attribute).toBe("strength");
  });
});

describe("normalizeWorkoutDay", () => {
  it("pins every exercise's section and stores the array in display order", () => {
    const day: WorkoutDay = {
      exercises: [
        planned("a", "push"),
        planned("b", "warm"),
        planned("c", "stretch"),
      ],
      groups: [],
    };
    const normalized = normalizeWorkoutDay(day, catalog);
    expect(normalized.exercises.map((we) => we.id)).toEqual(["b", "a", "c"]);
    expect(normalized.exercises.map((we) => we.section)).toEqual([
      "warmup",
      "strength",
      "flexibility",
    ]);
  });

  it("keeps a pinned day stable when the catalog is re-categorized later", () => {
    const day: WorkoutDay = {
      exercises: [planned("b", "warm"), planned("a", "push")],
      groups: [],
    };
    const pinned = normalizeWorkoutDay(day, catalog);

    // The admin later moves "warm" into prehabilitation in the catalog.
    const recategorized = new Map(catalog);
    recategorized.set("warm", exercise("warm", "prehabilitation"));

    // Before the pin this reshuffled the day (warm sank below strength);
    // with sections pinned the design keeps the order the athlete saw.
    const after = normalizeWorkoutDay(pinned, recategorized);
    expect(after.exercises.map((we) => we.id)).toEqual(
      pinned.exercises.map((we) => we.id),
    );
    expect(orderDayExercises(pinned.exercises, recategorized).map((we) => we.id)).toEqual(
      pinned.exercises.map((we) => we.id),
    );
  });
});
