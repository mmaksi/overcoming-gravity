import { ATTRIBUTE_ORDER, Attribute } from "./types";
import { DefaultTemplate, Exercise, WorkoutDay, WorkoutExercise } from "./schemas";

function newId(): string {
  return crypto.randomUUID();
}

/**
 * Build the prefilled workout day a user starts from in the mesocycle
 * designer: the admin's recommended defaults (warmup, skill, prehab,
 * isolation, flexibility, cooldown, …), sorted in workout order. Everything
 * returned here is fully editable; athletes add their own skill/strength
 * work from the library.
 */
export function buildDefaultWorkoutDay(
  template: DefaultTemplate,
  exercisesById: Map<string, Exercise>,
): WorkoutDay {
  const exercises: WorkoutExercise[] = template.entries
    .filter((entry) => exercisesById.has(entry.exerciseId))
    .map((entry) => ({
      id: newId(),
      exerciseId: entry.exerciseId,
      progressionId: entry.progressionId,
      sets: entry.sets.map((s) => ({ reps: s.reps })),
      restSeconds: entry.restSeconds,
      progressionMethod: "intra" as const,
    }));

  const attributeOf = (we: WorkoutExercise): Attribute =>
    exercisesById.get(we.exerciseId)?.attribute ?? "strength";

  exercises.sort(
    (a, b) =>
      ATTRIBUTE_ORDER.indexOf(attributeOf(a)) -
      ATTRIBUTE_ORDER.indexOf(attributeOf(b)),
  );

  return { exercises, groups: [] };
}
