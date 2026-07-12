import {
  Intensity,
  Periodization,
  Weekday,
  WEEKDAYS,
  WeekFocus,
} from "./types";
import { DefaultTemplate, Exercise, Mesocycle, Week } from "./schemas";
import { buildDefaultWorkoutDay } from "./defaults";

/**
 * Build the initial mesocycle a program starts with: every training day of
 * every week prefilled from the admin defaults; the final week is the deload.
 * Light / Heavy alternates day intensity within each week; Accumulation &
 * Intensification alternates the focus of WHOLE weeks. Both are editable
 * later in the designer.
 */
export function buildMesocycle(opts: {
  weeks: number;
  trainingDays: Weekday[];
  periodization: Periodization;
  template: DefaultTemplate;
  exercises: Exercise[];
}): Mesocycle {
  const { weeks, trainingDays, periodization, template, exercises } = opts;
  const exercisesById = new Map(exercises.map((e) => [e.id, e]));
  const orderedDays = WEEKDAYS.filter((d) => trainingDays.includes(d));

  const result: Week[] = [];
  for (let w = 0; w < weeks; w++) {
    const isDeload = w === weeks - 1;
    const days: Week["days"] = {};
    orderedDays.forEach((weekday, i) => {
      const day = buildDefaultWorkoutDay(template, exercisesById);
      if (periodization === "high_low") {
        const intensity: Intensity = isDeload
          ? "low"
          : i % 2 === 0
            ? "high"
            : "low";
        day.intensity = intensity;
      }
      days[weekday] = day;
    });
    const focus: WeekFocus | undefined =
      periodization === "daily_undulating" && !isDeload
        ? w % 2 === 0
          ? "accumulation"
          : "intensification"
        : undefined;
    result.push({ index: w, isDeload, focus, days });
  }
  return { weeks: result };
}
