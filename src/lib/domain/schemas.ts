import { z } from "zod";
import {
  ATTRIBUTES,
  CATEGORIES,
  GROUP_TYPES,
  INTENSITIES,
  MAX_WEEKS,
  MEASUREMENTS,
  MIN_WEEKS,
  PERIODIZATIONS,
  PROGRAM_TYPES,
  PROGRESSION_METHODS,
  REP_STYLES,
  SPLIT_TYPES,
  WEEKDAYS,
} from "./types";

// ---------------------------------------------------------------------------
// Admin-managed content

export const progressionSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  order: z.number().int().min(0),
  /** Every progression carries its own description (exercises don't). */
  description: z.string(),
});
export type Progression = z.infer<typeof progressionSchema>;

export const exerciseSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  category: z.enum(CATEGORIES),
  attribute: z.enum(ATTRIBUTES),
  /** Reps, or seconds of hold (isometrics like levers and L-sits). */
  measurement: z.enum(MEASUREMENTS).default("reps"),
  /** Cluster style marks eccentric work: rest between single reps in a set. */
  repStyle: z.enum(REP_STYLES).default("standard"),
  progressions: z.array(progressionSchema).min(1),
});
export type Exercise = z.infer<typeof exerciseSchema>;

/** One prefill entry of the admin-managed recommended defaults. */
export const templateEntrySchema = z.object({
  exerciseId: z.string(),
  progressionId: z.string(),
  sets: z.array(z.object({ reps: z.number().int().min(1) })).min(1),
  restSeconds: z.number().int().min(0),
});
export type TemplateEntry = z.infer<typeof templateEntrySchema>;

export const defaultTemplateSchema = z.object({
  id: z.literal("default"),
  entries: z.array(templateEntrySchema),
});
export type DefaultTemplate = z.infer<typeof defaultTemplateSchema>;

// ---------------------------------------------------------------------------
// Programs

/**
 * One planned set. `reps` is the target count — repetitions for rep
 * exercises, seconds of hold for time exercises, cluster reps for cluster
 * exercises.
 */
export const setPlanSchema = z.object({
  reps: z.number().int().min(1),
  weight: z.number().min(0).optional(),
});
export type SetPlan = z.infer<typeof setPlanSchema>;

export const workoutExerciseSchema = z.object({
  id: z.string(),
  exerciseId: z.string(),
  progressionId: z.string(),
  sets: z.array(setPlanSchema).min(1),
  restSeconds: z.number().int().min(0),
  /** Cluster exercises only: rest between the single reps inside a set. */
  clusterRestSeconds: z.number().int().min(0).optional(),
  progressionMethod: z.enum(PROGRESSION_METHODS),
  interTechniqueId: z.string().optional(),
  notes: z.string().optional(),
  /** When set, this exercise belongs to a group (superset/circuit/pyramid). */
  groupId: z.string().optional(),
});
export type WorkoutExercise = z.infer<typeof workoutExerciseSchema>;

export const exerciseGroupSchema = z.object({
  id: z.string(),
  type: z.enum(GROUP_TYPES),
});
export type ExerciseGroup = z.infer<typeof exerciseGroupSchema>;

export const workoutDaySchema = z.object({
  intensity: z.enum(INTENSITIES).optional(),
  exercises: z.array(workoutExerciseSchema),
  groups: z.array(exerciseGroupSchema).default([]),
});
export type WorkoutDay = z.infer<typeof workoutDaySchema>;

export const weekSchema = z.object({
  index: z.number().int().min(0),
  isDeload: z.boolean(),
  days: z.partialRecord(z.enum(WEEKDAYS), workoutDaySchema.nullable()),
});
export type Week = z.infer<typeof weekSchema>;

export const mesocycleSchema = z.object({
  weeks: z.array(weekSchema),
});
export type Mesocycle = z.infer<typeof mesocycleSchema>;

export const sportSchema = z.object({
  name: z.string().min(1),
  days: z.array(z.enum(WEEKDAYS)),
});
export type Sport = z.infer<typeof sportSchema>;

export const programSchema = z
  .object({
    id: z.string(),
    userId: z.string(),
    name: z.string().min(1),
    type: z.enum(PROGRAM_TYPES),
    splitType: z.enum(SPLIT_TYPES).optional(),
    sport: sportSchema.optional(),
    periodization: z.enum(PERIODIZATIONS),
    weeks: z.number().int().min(MIN_WEEKS).max(MAX_WEEKS),
    trainingDays: z.array(z.enum(WEEKDAYS)).min(1),
    mesocycle: mesocycleSchema,
    status: z.enum(["draft", "active", "archived"]),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .refine((p) => p.type !== "split" || p.splitType !== undefined, {
    message: "Split programs must choose a split type",
    path: ["splitType"],
  })
  .refine((p) => p.type !== "sport_mix" || p.sport !== undefined, {
    message: "Sport-mix programs must define the sport",
    path: ["sport"],
  });
export type Program = z.infer<typeof programSchema>;

// ---------------------------------------------------------------------------
// Tracking

export const programRunSchema = z.object({
  id: z.string(),
  programId: z.string(),
  userId: z.string(),
  /** ISO date (yyyy-mm-dd) of day one of week one. */
  startDate: z.string(),
  status: z.enum(["active", "completed", "abandoned"]),
  createdAt: z.string(),
});
export type ProgramRun = z.infer<typeof programRunSchema>;

/**
 * One logged set. `reps` (or seconds for holds) is null while the athlete
 * hasn't recorded it yet — drafts keep nulls; completing a workout resolves
 * empty inputs to their suggested values.
 */
export const performedSetSchema = z.object({
  reps: z.number().int().min(0).nullable(),
  weight: z.number().min(0).optional(),
  /** Hybrid sets: the progression actually used for this set. */
  progressionId: z.string().optional(),
  /** Hybrid sets with eccentrics: eccentric reps done after the dynamic reps. */
  eccentricReps: z.number().int().min(0).optional(),
});
export type PerformedSet = z.infer<typeof performedSetSchema>;

export const sessionEntrySchema = z.object({
  /** id of the WorkoutExercise in the plan this entry belongs to. */
  workoutExerciseId: z.string(),
  exerciseId: z.string(),
  /** May differ from the plan: athletes can swap progression mid-workout. */
  progressionId: z.string(),
  performedSets: z.array(performedSetSchema),
  /** Session-level inter-exercise technique pick (overrides the plan's). */
  interTechniqueId: z.string().optional(),
  notes: z.string().optional(),
});
export type SessionEntry = z.infer<typeof sessionEntrySchema>;

export const workoutSessionSchema = z.object({
  id: z.string(),
  runId: z.string(),
  userId: z.string(),
  /** ISO date (yyyy-mm-dd). */
  date: z.string(),
  weekIndex: z.number().int().min(0),
  weekday: z.enum(WEEKDAYS),
  status: z.enum(["planned", "completed", "skipped"]),
  entries: z.array(sessionEntrySchema),
});
export type WorkoutSession = z.infer<typeof workoutSessionSchema>;

// ---------------------------------------------------------------------------
// Users

export const profileSchema = z.object({
  id: z.string(),
  email: z.string().optional(),
  name: z.string(),
  isAdmin: z.boolean(),
});
export type Profile = z.infer<typeof profileSchema>;

/** Last recorded volume for an exercise+progression (intra-exercise memory). */
export type LastVolume = {
  date: string;
  performedSets: PerformedSet[];
};

/** Historical stats for one exercise progression. */
export type VolumeStats = {
  last: LastVolume | null;
  /** Best single-set value ever logged (reps, or seconds for holds). */
  maxReps: number | null;
};
