import {
  ExerciseGroup,
  Mesocycle,
  WorkoutDay,
  WorkoutExercise,
} from "@/lib/domain/schemas";
import { GROUP_TYPE_RULES, Weekday } from "@/lib/domain/types";

/** Deep-clone a workout day, assigning fresh ids to every exercise. */
export function cloneDay(day: WorkoutDay): WorkoutDay {
  return {
    intensity: day.intensity,
    groups: (day.groups ?? []).map((g) => ({ ...g })),
    exercises: day.exercises.map((we) => ({
      ...we,
      id: crypto.randomUUID(),
      sets: we.sets.map((s) => ({ ...s })),
    })),
  };
}

export function updateDay(
  meso: Mesocycle,
  weekIndex: number,
  weekday: Weekday,
  updater: (day: WorkoutDay) => WorkoutDay,
): Mesocycle {
  return {
    weeks: meso.weeks.map((week) =>
      week.index === weekIndex
        ? {
            ...week,
            days: {
              ...week.days,
              [weekday]: updater(
                week.days[weekday] ?? { exercises: [], groups: [] },
              ),
            },
          }
        : week,
    ),
  };
}

export function updateExercise(
  meso: Mesocycle,
  weekIndex: number,
  weekday: Weekday,
  exerciseId: string,
  updater: (we: WorkoutExercise) => WorkoutExercise,
): Mesocycle {
  return updateDay(meso, weekIndex, weekday, (day) => ({
    ...day,
    exercises: day.exercises.map((we) =>
      we.id === exerciseId ? updater(we) : we,
    ),
  }));
}

/** Move an exercise within a day to a new position. */
export function reorderExercises(
  day: WorkoutDay,
  fromId: string,
  toId: string,
): WorkoutDay {
  const from = day.exercises.findIndex((we) => we.id === fromId);
  const to = day.exercises.findIndex((we) => we.id === toId);
  if (from === -1 || to === -1 || from === to) return day;
  const next = [...day.exercises];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return { ...day, exercises: next };
}

/**
 * Put the selected exercises in a mode (superset/pyramid/HIIT/…). How many
 * exercises each mode accepts is enforced by the UI (GROUP_TYPE_RULES).
 * Members are made contiguous at the position of the first selected
 * exercise; previous group membership of the selection is dissolved.
 * Designing only picks the mode — its timing/shape settings are chosen at
 * workout time in the logger, not stored on the plan.
 */
export function groupExercises(
  day: WorkoutDay,
  ids: string[],
  type: ExerciseGroup["type"],
): WorkoutDay {
  if (ids.length < 1) return day;
  const groupId = crypto.randomUUID();
  const selected = day.exercises.filter((we) => ids.includes(we.id));
  const rest = day.exercises.filter((we) => !ids.includes(we.id));
  const anchor = day.exercises.findIndex((we) => ids.includes(we.id));
  const members = selected.map(
    (we): WorkoutExercise => ({ ...we, groupId }),
  );
  let exercises = [
    ...rest.slice(0, anchor),
    ...members,
    ...rest.slice(anchor),
  ];
  // Pulling members out of an existing group can leave it below its mode's
  // minimum (e.g. a 1-exercise superset) — such groups dissolve entirely.
  const stale = (day.groups ?? []).filter((g) => {
    const count = exercises.filter((we) => we.groupId === g.id).length;
    return count === 0 || !GROUP_TYPE_RULES[g.type].accepts(count);
  });
  if (stale.length > 0) {
    const staleIds = new Set(stale.map((g) => g.id));
    exercises = exercises.map((we) =>
      we.groupId && staleIds.has(we.groupId)
        ? { ...we, groupId: undefined }
        : we,
    );
  }
  const groups = [
    ...(day.groups ?? []).filter(
      (g) => !stale.some((s) => s.id === g.id),
    ),
    { id: groupId, type },
  ];
  return { ...day, exercises, groups };
}

/** Dissolve a group; its exercises stay in place, ungrouped. */
export function ungroupExercises(day: WorkoutDay, groupId: string): WorkoutDay {
  return {
    ...day,
    exercises: day.exercises.map((we) =>
      we.groupId === groupId ? { ...we, groupId: undefined } : we,
    ),
    groups: (day.groups ?? []).filter((g) => g.id !== groupId),
  };
}

/** Copy one day's workout over other days of the same week. */
export function copyDayToDays(
  meso: Mesocycle,
  weekIndex: number,
  source: Weekday,
  targets: Weekday[],
): Mesocycle {
  const week = meso.weeks.find((w) => w.index === weekIndex);
  const sourceDay = week?.days[source];
  if (!sourceDay) return meso;
  let next = meso;
  for (const target of targets) {
    next = updateDay(next, weekIndex, target, (day) => ({
      ...cloneDay(sourceDay),
      // keep the target day's own intensity tag
      intensity: day.intensity,
    }));
  }
  return next;
}

/** Copy a whole week's workouts over other weeks (per matching weekday). */
export function copyWeekToWeeks(
  meso: Mesocycle,
  sourceIndex: number,
  targetIndexes: number[],
): Mesocycle {
  const source = meso.weeks.find((w) => w.index === sourceIndex);
  if (!source) return meso;
  return {
    weeks: meso.weeks.map((week) => {
      if (!targetIndexes.includes(week.index)) return week;
      const days: typeof week.days = {};
      for (const [weekday, day] of Object.entries(source.days)) {
        if (!day) {
          days[weekday as Weekday] = day;
          continue;
        }
        const copied = cloneDay(day);
        // keep the target day's own high/low tag (e.g. deload stays low)
        const existing = week.days[weekday as Weekday];
        copied.intensity = existing?.intensity ?? copied.intensity;
        days[weekday as Weekday] = copied;
      }
      return { ...week, days };
    }),
  };
}
