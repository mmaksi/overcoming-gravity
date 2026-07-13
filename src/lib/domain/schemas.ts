import { z } from "zod";
import {
  Attribute,
  ATTRIBUTES,
  CATEGORIES,
  FEEDBACK_TYPES,
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
  WEEK_FOCUSES,
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
  /** Optional illustration shown in the picker; admin-managed. */
  imageUrl: z.string().url().or(z.literal("")).optional(),
  progressions: z.array(progressionSchema).min(1),
});
export type Exercise = z.infer<typeof exerciseSchema>;

// defaultTemplateSchema is defined below the program section: the template
// is a full WorkoutDay so the defaults admin page is the designer day UI.

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
  /** Rep tempo, e.g. "31X1" (eccentric-pause-concentric-pause seconds). */
  tempo: z.string().optional(),
  /** Cluster exercises only: rest between the single reps inside a set. */
  clusterRestSeconds: z.number().int().min(0).optional(),
  progressionMethod: z.enum(PROGRESSION_METHODS),
  interTechniqueId: z.string().optional(),
  notes: z.string().optional(),
  /** When set, this exercise belongs to a group (superset/circuit/pyramid). */
  groupId: z.string().optional(),
  /**
   * The day section this exercise appears in. Any exercise can be added to
   * any section; when unset it shows in its own attribute's section.
   */
  section: z.enum(ATTRIBUTES).optional(),
});
export type WorkoutExercise = z.infer<typeof workoutExerciseSchema>;

/** The day section a planned exercise belongs to (see `section` above). */
export function sectionOf(
  we: WorkoutExercise,
  exercisesById: Map<string, Exercise>,
): Attribute {
  return we.section ?? exercisesById.get(we.exerciseId)?.attribute ?? "strength";
}

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

/**
 * The admin-managed recommended defaults: a full workout day every new
 * program day is prefilled from (the strength section always starts empty
 * for athletes regardless of what the template holds).
 */
export const defaultTemplateSchema = z.object({
  id: z.literal("default"),
  day: workoutDaySchema,
});
export type DefaultTemplate = z.infer<typeof defaultTemplateSchema>;

export const weekSchema = z.object({
  index: z.number().int().min(0),
  isDeload: z.boolean(),
  /** Accumulation & Intensification: the whole week's focus. */
  focus: z.enum(WEEK_FOCUSES).optional(),
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

/** One program goal; `done` is ticked by the athlete from the dashboard. */
export const goalItemSchema = z.object({
  text: z.string().min(1),
  done: z.boolean().default(false),
});
export type GoalItem = z.infer<typeof goalItemSchema>;

/**
 * Up to 2 goals per area, defined when the program is created. One goal in
 * total (any area) is enough.
 */
const goalAreaSchema = z.array(goalItemSchema).max(2).default([]);
export const goalsSchema = z
  .object({
    skills: goalAreaSchema,
    push: goalAreaSchema,
    pull: goalAreaSchema,
    // Added later — programs stored before then simply miss these keys.
    flexibility: goalAreaSchema,
    other: goalAreaSchema,
  })
  .refine(
    (g) =>
      g.skills.length +
        g.push.length +
        g.pull.length +
        g.flexibility.length +
        g.other.length >=
      1,
    { message: "Define at least one goal" },
  );
export type Goals = z.infer<typeof goalsSchema>;

export const programSchema = z
  .object({
    id: z.string(),
    userId: z.string(),
    name: z.string().min(1),
    type: z.enum(PROGRAM_TYPES),
    splitType: z.enum(SPLIT_TYPES).optional(),
    sport: sportSchema.optional(),
    /** Optional for programs created before goals existed. */
    goals: goalsSchema.optional(),
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

/**
 * A standalone workout the user builds outside any program: a title and a
 * bunch of exercises (same day structure as a program day) — no goals, no
 * periodization. Doing one creates a session with `customWorkoutId` set.
 */
export const customWorkoutSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string().min(1).max(80),
  day: workoutDaySchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type CustomWorkout = z.infer<typeof customWorkoutSchema>;

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
  /** Legacy hybrid sets: the single progression used for this set. */
  progressionId: z.string().optional(),
  /**
   * Hybrid sets: one set can mix several progressions of the same exercise
   * (e.g. 1 full push-up + 5 knee push-ups in set 1). When present, `reps`
   * holds the total across parts.
   */
  parts: z
    .array(
      z.object({
        progressionId: z.string(),
        reps: z.number().int().min(0),
      }),
    )
    .optional(),
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

export const workoutSessionSchema = z
  .object({
    id: z.string(),
    /** Set for program sessions. */
    runId: z.string().optional(),
    /** Set for standalone custom-workout sessions. */
    customWorkoutId: z.string().optional(),
    userId: z.string(),
    /** ISO date (yyyy-mm-dd). */
    date: z.string(),
    weekIndex: z.number().int().min(0),
    weekday: z.enum(WEEKDAYS),
    status: z.enum(["planned", "completed", "skipped"]),
    entries: z.array(sessionEntrySchema),
    /** Active workout time in seconds (paused while the draft is closed). */
    durationSeconds: z.number().int().min(0).optional(),
  })
  .refine((s) => s.runId !== undefined || s.customWorkoutId !== undefined, {
    message: "A session belongs to a run or to a custom workout",
  });
export type WorkoutSession = z.infer<typeof workoutSessionSchema>;

/**
 * A user's remembered note for one exercise + inter-exercise technique pair.
 * Written whenever the athlete logs a note with a technique; read back to
 * prefill the note the next time they pick that exercise with that technique.
 */
export const exerciseNoteSchema = z.object({
  userId: z.string(),
  exerciseId: z.string(),
  techniqueId: z.string(),
  note: z.string(),
  updatedAt: z.string(),
});
export type ExerciseNote = z.infer<typeof exerciseNoteSchema>;

/** Map key for exercise-note lookups. */
export function exerciseNoteKey(exerciseId: string, techniqueId: string) {
  return `${exerciseId}:${techniqueId}`;
}

/**
 * Notes are remembered per exercise (not per technique) so they show up every
 * time that exercise is trained. They're stored under this sentinel
 * technique id, which keeps the (user, exercise, technique) row shape intact.
 */
export const EXERCISE_NOTE_TECHNIQUE = "_exercise";

// ---------------------------------------------------------------------------
// Users

export const profileSchema = z.object({
  id: z.string(),
  email: z.string().optional(),
  name: z.string(),
  isAdmin: z.boolean(),
  /** Optional profile picture, shown on the home header. */
  avatarUrl: z.string().optional(),
});
export type Profile = z.infer<typeof profileSchema>;

// ---------------------------------------------------------------------------
// Bodyweight tracking

export const bodyweightEntrySchema = z.object({
  id: z.string(),
  userId: z.string(),
  /** ISO date (YYYY-MM-DD) the weight was recorded for. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Stored in kilograms. */
  weightKg: z.number().positive().max(1000),
  createdAt: z.string(),
});
export type BodyweightEntry = z.infer<typeof bodyweightEntrySchema>;

// ---------------------------------------------------------------------------
// Feedback

export const feedbackSchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: z.enum(FEEDBACK_TYPES),
  message: z.string().min(1).max(4000),
  createdAt: z.string(),
});
export type Feedback = z.infer<typeof feedbackSchema>;

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
