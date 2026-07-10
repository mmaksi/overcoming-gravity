import { Intensity, Periodization, Weekday, WEEKDAYS } from "./types";
import { DefaultTemplate, Exercise, Mesocycle, Week } from "./schemas";
import { buildDefaultWorkoutDay } from "./defaults";

/**
 * Build the initial mesocycle a program starts with: every training day of
 * every week prefilled from the admin defaults. When a periodization
 * technique is chosen, training days alternate high/low volume (editable
 * later in the designer); the final week is the deload and is flagged low
 * across the board.
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
      if (periodization !== "none") {
        const intensity: Intensity = isDeload
          ? "low"
          : i % 2 === 0
            ? "high"
            : "low";
        day.intensity = intensity;
      }
      days[weekday] = day;
    });
    result.push({ index: w, isDeload, days });
  }
  return { weeks: result };
}
