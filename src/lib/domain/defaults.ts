import { ATTRIBUTE_ORDER, Attribute } from "./types";
import { DefaultTemplate, Exercise, WorkoutDay } from "./schemas";

/**
 * Build the prefilled workout day a user starts from in the mesocycle
 * designer: a deep copy of the admin's template day (warmup, skill, prehab,
 * isolation, flexibility, cooldown, …) with fresh ids, sorted in workout
 * order. The strength section always starts empty — athletes pick their own
 * strength work from the library. Everything returned here is fully
 * editable.
 */
export function buildDefaultWorkoutDay(
  template: DefaultTemplate,
  exercisesById: Map<string, Exercise>,
): WorkoutDay {
  const attributeOf = (exerciseId: string): Attribute =>
    exercisesById.get(exerciseId)?.attribute ?? "strength";

  // Fresh ids per copy; remember the mapping so groups stay intact.
  const idMap = new Map<string, string>();
  const exercises = template.day.exercises
    .filter((we) => exercisesById.has(we.exerciseId))
    .filter((we) => attributeOf(we.exerciseId) !== "strength")
    .map((we) => {
      const id = crypto.randomUUID();
      idMap.set(we.id, id);
      return { ...we, id, sets: we.sets.map((s) => ({ ...s })) };
    });

  exercises.sort(
    (a, b) =>
      ATTRIBUTE_ORDER.indexOf(attributeOf(a.exerciseId)) -
      ATTRIBUTE_ORDER.indexOf(attributeOf(b.exerciseId)),
  );

  const groups = (template.day.groups ?? []).filter((g) =>
    exercises.some((we) => we.groupId === g.id),
  );
  return { exercises, groups: groups.map((g) => ({ ...g })) };
}
