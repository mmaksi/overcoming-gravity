import { z } from "zod";
import {
  Attribute,
  ATTRIBUTE_ORDER,
  ATTRIBUTES,
  CATEGORIES,
  FEEDBACK_TYPES,
  GROUP_TYPES,
  INTENSITIES,
  MAX_WEEKS,
  Measurement,
  MEASUREMENTS,
  MIN_WEEKS,
  PERIODIZATIONS,
  PROGRAM_TYPES,
  PROGRESSION_METHODS,
  REP_STYLES,
  SPLIT_TYPES,
  WEEK_FOCUSES,
  WeekFocus,
  WEEKDAYS,
} from "./types";

// ---------------------------------------------------------------------------
// Admin-managed content

/**
 * A measurement unit as stored. Accepts the current units and silently maps the
 * legacy "time" (which meant seconds) forward, so progressions/rows saved
 * before the seconds/minutes split keep parsing.
 */
const measurementValue = z.preprocess(
  (v) => (v === "time" ? "seconds" : v),
  z.enum(MEASUREMENTS),
);

export const progressionSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  order: z.number().int().min(0),
  /** Every progression carries its own description (exercises don't). */
  description: z.string(),
  /**
   * How this progression is measured (reps, seconds, or minutes of hold).
   * Optional for back-compat: progressions saved before per-progression
   * measurement fall back to the exercise-level `measurement`. See
   * `measurementOf`.
   */
  measurement: measurementValue.optional(),
  /** Optional YouTube tutorial, embedded in the workout logger's info sheet. */
  videoUrl: z.string().url().or(z.literal("")).optional(),
  /** Optional illustration for this progression (falls back to the exercise's). */
  imageUrl: z.string().url().or(z.literal("")).optional(),
});
export type Progression = z.infer<typeof progressionSchema>;

export const exerciseSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  category: z.enum(CATEGORIES),
  attribute: z.enum(ATTRIBUTES),
  /**
   * Exercise-level default measurement — a coarse fallback only. The precise
   * per-progression unit (reps/seconds/minutes) lives on each progression; this
   * column stays reps/seconds so the persisted DB check constraint holds. Each
   * progression overrides it; resolve the effective value with `measurementOf`.
   */
  measurement: measurementValue.default("reps"),
  /** Cluster style marks eccentric work: rest between single reps in a set. */
  repStyle: z.enum(REP_STYLES).default("standard"),
  /**
   * The sport this exercise belongs to ("Calisthenics", "Parkour", …) — a
   * free-form admin-managed name, so new sports need no code change. Optional
   * for back-compat: exercises saved before sports existed are calisthenics.
   * Resolve the effective value with `exerciseSport`.
   */
  sport: z.string().min(1).optional(),
  /** Optional illustration shown in the picker; admin-managed. */
  imageUrl: z.string().url().or(z.literal("")).optional(),
  progressions: z.array(progressionSchema).min(1),
});
export type Exercise = z.infer<typeof exerciseSchema>;

/** Exercises saved before sports existed are calisthenics — the app's core. */
export const DEFAULT_SPORT = "Calisthenics";

/** The exercise's effective sport (legacy rows default to calisthenics). */
export function exerciseSport(
  exercise: Pick<Exercise, "sport">,
): string {
  return exercise.sport?.trim() || DEFAULT_SPORT;
}

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
  // Target per set in the progression's unit: reps, seconds, or minutes of
  // hold. Fractional so a target can be e.g. 1.5 minutes.
  reps: z.number().positive(),
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
  /**
   * Per-program unit override: when the athlete flips the unit while designing
   * a program (tap the unit word), it's stored here and wins over the
   * progression's own measurement. Unset = follow the progression. See
   * `measurementOf`.
   */
  measurement: measurementValue.optional(),
});
export type WorkoutExercise = z.infer<typeof workoutExerciseSchema>;

/** Legacy "time" (pre-minutes) means seconds; unknown values are ignored. */
function normalizeMeasurement(
  m: string | undefined | null,
): Measurement | undefined {
  if (m === "time") return "seconds";
  if (m === "reps" || m === "seconds" || m === "minutes") return m;
  return undefined;
}

/**
 * The effective measurement (reps / seconds / minutes) for a planned exercise:
 * a per-program (or per-session) override wins, then the chosen progression's
 * own measurement, then the exercise-level default, finally "reps".
 */
export function measurementOf(
  exercise: Pick<Exercise, "measurement" | "progressions"> | undefined,
  progressionId: string | undefined,
  override?: Measurement,
): Measurement {
  const prog = exercise?.progressions.find((p) => p.id === progressionId);
  return (
    normalizeMeasurement(override) ??
    normalizeMeasurement(prog?.measurement) ??
    normalizeMeasurement(exercise?.measurement) ??
    "reps"
  );
}

/** True for hold measurements (seconds or minutes), false for reps. */
export function isTimeMeasurement(m: Measurement): boolean {
  return m === "seconds" || m === "minutes";
}

/**
 * Convert a value between units, preserving the physical quantity where that's
 * meaningful (seconds↔minutes). Reps↔time keeps the raw number, since a rep
 * count and a hold length aren't interchangeable.
 */
export function convertMeasureValue(
  value: number,
  from: Measurement,
  to: Measurement,
): number {
  if (from === to || from === "reps" || to === "reps") return value;
  const seconds = from === "minutes" ? value * 60 : value;
  const out = to === "minutes" ? seconds / 60 : seconds;
  return Math.round(out * 100) / 100;
}

/**
 * Sensible default per-set target when an exercise is first added, in the
 * progression's unit: 8 reps, a 10-second hold, or a 1-minute hold.
 */
export function defaultSetTarget(m: Measurement): number {
  return m === "minutes" ? 1 : m === "seconds" ? 10 : 8;
}

/** The day section a planned exercise belongs to (see `section` above). */
export function sectionOf(
  we: WorkoutExercise,
  exercisesById: Map<string, Exercise>,
): Attribute {
  return we.section ?? exercisesById.get(we.exerciseId)?.attribute ?? "strength";
}

/** One rendered section of a workout day. */
export type WorkoutDaySection = {
  attribute: Attribute;
  exercises: WorkoutExercise[];
};

/**
 * The canonical display order of a workout day: sections in ATTRIBUTE_ORDER,
 * original array order within each section. Every screen (designer, logger,
 * home preview) renders this order and the save actions persist it back
 * (see `normalizeWorkoutDay`), so the stored array and every view agree.
 */
export function daySections(
  exercises: WorkoutExercise[],
  exercisesById: Map<string, Exercise>,
): WorkoutDaySection[] {
  return ATTRIBUTE_ORDER.map((attribute) => ({
    attribute,
    exercises: exercises.filter(
      (we) => sectionOf(we, exercisesById) === attribute,
    ),
  })).filter((s) => s.exercises.length > 0);
}

/** A day's exercises flattened into canonical display order. */
export function orderDayExercises(
  exercises: WorkoutExercise[],
  exercisesById: Map<string, Exercise>,
): WorkoutExercise[] {
  return daySections(exercises, exercisesById).flatMap((s) => s.exercises);
}

/**
 * Pin a day to what the athlete sees in the designer: every exercise gets an
 * explicit `section` (resolved against the current catalog) and the array is
 * stored in canonical display order. Without the pin, entries created before
 * the `section` field (wizard/template days) resolve their section from the
 * live catalog at render time — so an admin re-categorizing an exercise
 * silently reshuffled already-designed workouts. Once pinned, the order
 * created in the designer is exactly the order the workout runs in.
 */
export function normalizeWorkoutDay(
  day: WorkoutDay,
  exercisesById: Map<string, Exercise>,
): WorkoutDay {
  return {
    ...day,
    exercises: daySections(day.exercises, exercisesById).flatMap((s) =>
      s.exercises.map((we) =>
        we.section === s.attribute ? we : { ...we, section: s.attribute },
      ),
    ),
  };
}

export const exerciseGroupSchema = z.object({
  id: z.string(),
  type: z.enum(GROUP_TYPES),
  /**
   * Mode timing, meaning depends on the type: superset — rest after each
   * round of the pair; pyramid/ladder — rest between steps; HIIT — rest
   * between work intervals; Tabata — always 10.
   */
  restSeconds: z.number().int().positive().optional(),
  /** Pyramid/Ladder: how many steps (= sets the athlete climbs through). */
  steps: z.number().int().positive().optional(),
  /** HIIT/Tabata: the work interval (Tabata is always 20). */
  workSeconds: z.number().int().positive().optional(),
  /** HIIT/Tabata: how many work intervals (Tabata is always 8). */
  rounds: z.number().int().positive().optional(),
});
export type ExerciseGroup = z.infer<typeof exerciseGroupSchema>;

/** "90s" for odd amounts, "2 min" for whole minutes. */
function shortDuration(seconds: number): string {
  return seconds % 60 === 0 ? `${seconds / 60} min` : `${seconds}s`;
}

/**
 * Compact human summary of a group's mode settings ("rest 2 min",
 * "5 steps · rest 60s", "30s/30s × 8 · 4 min total"), or null when the
 * group carries none. Shown beside the mode badge in the designer and logger.
 */
export function groupConfigSummary(group: ExerciseGroup): string | null {
  switch (group.type) {
    case "superset":
      return group.restSeconds
        ? `rest ${shortDuration(group.restSeconds)}`
        : null;
    case "pyramid":
    case "ladder": {
      const parts = [
        group.steps != null ? `${group.steps} steps` : null,
        group.restSeconds != null
          ? `rest ${shortDuration(group.restSeconds)}`
          : null,
      ].filter(Boolean);
      return parts.length > 0 ? parts.join(" · ") : null;
    }
    case "hiit": {
      if (!group.workSeconds || !group.restSeconds || !group.rounds)
        return null;
      const totalMin =
        (group.rounds * (group.workSeconds + group.restSeconds)) / 60;
      const total = Number.isInteger(totalMin)
        ? String(totalMin)
        : totalMin.toFixed(1);
      return `${group.workSeconds}s/${group.restSeconds}s × ${group.rounds} · ${total} min total`;
    }
    case "tabata":
      return "20s/10s × 8 · 4 min total";
    default:
      return null;
  }
}

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
  // The logged value in the entry's unit (reps, seconds, or minutes of hold);
  // null while not yet recorded. Fractional so minute holds can be e.g. 1.5.
  reps: z.number().min(0).nullable(),
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
  /**
   * The unit the athlete logged in this session — they can switch reps/seconds/
   * minutes mid-workout. Unset = follow the plan/progression measurement.
   */
  measurement: measurementValue.optional(),
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
 * A user's remembered note for one exercise **progression**. Written whenever
 * the athlete logs a note while training a progression; read back to prefill
 * the note the next time they train that same progression (swapping the
 * progression mid-workout surfaces that progression's own note).
 *
 * Storage note: this reuses the persisted `exercise_notes.technique_id` column
 * to carry the progression id (see the stores), so moving notes from
 * per-exercise to per-progression needs no schema migration.
 */
export const exerciseNoteSchema = z.object({
  userId: z.string(),
  exerciseId: z.string(),
  progressionId: z.string(),
  note: z.string(),
  updatedAt: z.string(),
});
export type ExerciseNote = z.infer<typeof exerciseNoteSchema>;

/** Map key for remembered-note lookups (one note per exercise progression). */
export function exerciseNoteKey(exerciseId: string, progressionId: string) {
  return `${exerciseId}:${progressionId}`;
}

// ---------------------------------------------------------------------------
// Users

export const profileSchema = z.object({
  id: z.string(),
  email: z.string().optional(),
  name: z.string(),
  /**
   * Provider-sourced first/last name (Google's full name split at the
   * first space; granular claims preferred when a provider sends them).
   * `name` stays the editable display name — these power the greeting.
   */
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  isAdmin: z.boolean(),
  /** Optional profile picture, shown on the home header. */
  avatarUrl: z.string().optional(),
  /** Body stats for BMI: height and the weight the athlete is aiming for. */
  heightCm: z.number().positive().max(300).optional(),
  targetWeightKg: z.number().positive().max(1000).optional(),
  /**
   * Show the welcome tour on the next visit. True for new signups (and for
   * everyone who existed before the tour shipped); dismissed after viewing.
   * Settings can flip it back on.
   */
  showWelcome: z.boolean().default(true),
  /** Show the workout-designer intro carousel; dismissed after first view. */
  showDesignerIntro: z.boolean().default(true),
  /**
   * Billing, kept provider-neutral (the payment provider seam lives in
   * lib/billing): "pro" while a subscription entitles full access. Free
   * accounts can log workouts but not design programs, and create at most
   * FREE_CUSTOM_WORKOUT_LIMIT custom workouts.
   */
  plan: z.enum(["free", "pro"]).default("free"),
  planInterval: z.enum(["month", "year"]).optional(),
  /** When the current billing period renews (or ends, when cancelled). */
  planRenewsAt: z.string().optional(),
  planCancelAtPeriodEnd: z.boolean().default(false),
  /** Which payment provider owns this user's billing (e.g. "stripe"). */
  billingProvider: z.string().optional(),
  /** The provider's customer reference (e.g. a Stripe customer id). */
  billingCustomerId: z.string().optional(),
  /**
   * True once the user has ever held a subscription, even a cancelled one.
   * Copy only — paywalls hide the free-trial promise from lapsed
   * subscribers; startCheckout decides actual trial eligibility itself.
   */
  hadSubscription: z.boolean().default(false),
  /**
   * Where the signup came from (`?source=` on the login URL — e.g.
   * "instagram", "landing-hero"). Written once at first sign-in, never
   * overwritten; analytics only.
   */
  signupSource: z.string().optional(),
});
export type Profile = z.infer<typeof profileSchema>;

/** `?source=` values: short slugs only, anything else is dropped. */
export function normalizeSignupSource(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().toLowerCase();
  return /^[a-z0-9_-]{1,40}$/.test(trimmed) ? trimmed : null;
}

/**
 * A subscription's provider-normalized state, as reported by a webhook or a
 * post-checkout sync. Written onto the profile by the server only.
 */
export type SubscriptionSnapshot = {
  subscriptionId: string;
  /** Provider-normalized: "active" | "trialing" | "past_due" | "canceled" | … */
  status: string;
  interval: "month" | "year";
  /** ISO timestamp the current period ends (renewal or expiry). */
  periodEnd?: string;
  cancelAtPeriodEnd: boolean;
};

/** Statuses that entitle full access — past_due keeps access as a grace. */
export function planFromStatus(status: string | null | undefined): "free" | "pro" {
  return status === "active" || status === "trialing" || status === "past_due"
    ? "pro"
    : "free";
}

// ---------------------------------------------------------------------------
// Vouchers

/**
 * Admin-created discount codes, owned by the app (not the payment provider,
 * which merely gets told the percentage at checkout). A voucher can be
 * limited to a validity window and a number of redemptions.
 */
export const voucherSchema = z.object({
  id: z.string(),
  /** Stored uppercase; matching is case-insensitive. */
  code: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[A-Za-z0-9_-]+$/, "letters, numbers, - and _ only")
    .transform((c) => c.toUpperCase()),
  percentOff: z.number().int().min(1).max(100),
  /** ISO date (inclusive) the code starts working; unset = immediately. */
  validFrom: z.string().optional(),
  /** ISO date (inclusive) the code stops working; unset = no expiry. */
  validUntil: z.string().optional(),
  maxRedemptions: z.number().int().positive().optional(),
  redemptions: z.number().int().min(0).default(0),
  createdAt: z.string(),
});
export type Voucher = z.infer<typeof voucherSchema>;

/** Why a voucher can't be redeemed today — null means it's good to use. */
export function voucherProblem(
  voucher: Voucher,
  todayISO: string,
): "not yet valid" | "expired" | "fully redeemed" | null {
  if (voucher.validFrom && todayISO < voucher.validFrom) return "not yet valid";
  if (voucher.validUntil && todayISO > voucher.validUntil) return "expired";
  if (
    voucher.maxRedemptions !== undefined &&
    voucher.redemptions >= voucher.maxRedemptions
  ) {
    return "fully redeemed";
  }
  return null;
}

/** Body stats editable in Settings (null clears a value). */
export type ProfileStats = {
  heightCm: number | null;
  targetWeightKg: number | null;
};

/** BMI from weight and height; null when either half is missing. */
export function bmiOf(
  weightKg: number | undefined,
  heightCm: number | undefined,
): number | null {
  if (!weightKg || !heightCm) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

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

// ---------------------------------------------------------------------------
// Read projections
//
// Lightweight shapes for list/summary screens that don't need the whole
// aggregate. The heavy fields are the embedded `mesocycle` (a Program's full
// week-by-week plan), the `day` (a custom workout's exercises) and a session's
// performed-set `entries`. Summary read methods on the DataStore return these
// so the dashboard, program list and calendar don't download plans they never
// show. See docs/performance-data-transfer-review.md.

/** A program without its mesocycle — list cards, dashboard and calendar. */
export type ProgramSummary = Omit<Program, "mesocycle">;

/** A session without its performed-set entries — calendar and dashboard. */
export type SessionSummary = Omit<WorkoutSession, "entries"> & {
  /** Whether any sets have been logged (drives "Continue" vs "Start"). */
  hasEntries: boolean;
};

/** A custom workout without its day — history labels and lists. */
export type CustomWorkoutSummary = Omit<CustomWorkout, "day">;

/**
 * One planned day plus its week's training context (deload / A&I focus) —
 * what the workout logger and the dashboard's "up next" preview need, read
 * without downloading the whole mesocycle.
 */
export type ProgramDayPlan = {
  day: WorkoutDay;
  isDeload: boolean;
  focus?: WeekFocus;
};
