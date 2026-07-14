// Core domain vocabulary: enums as const tuples plus human-readable labels.
// Zod schemas in ./schemas.ts are the single source of truth for shapes;
// this file holds the constants they are built from.

export const CATEGORIES = ["push", "pull", "both", "legs"] as const;
export type Category = (typeof CATEGORIES)[number];

export const ATTRIBUTES = [
  "warmup",
  "skill",
  "strength",
  "prehabilitation",
  "isolation",
  "flexibility",
  "cooldown",
] as const;
export type Attribute = (typeof ATTRIBUTES)[number];

/** The order in which attributes appear inside a workout. */
export const ATTRIBUTE_ORDER: Attribute[] = [
  "warmup",
  "skill",
  "strength",
  "prehabilitation",
  "isolation",
  "flexibility",
  "cooldown",
];

export const WEEKDAYS = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const PROGRAM_TYPES = ["full_body", "split", "sport_mix"] as const;
export type ProgramType = (typeof PROGRAM_TYPES)[number];

export const SPLIT_TYPES = [
  "straight_arm_bent_arm",
  "push_pull",
  "upper_lower",
] as const;
export type SplitType = (typeof SPLIT_TYPES)[number];

export const PERIODIZATIONS = ["none", "daily_undulating", "high_low"] as const;
export type Periodization = (typeof PERIODIZATIONS)[number];

export const INTENSITIES = ["high", "low"] as const;
export type Intensity = (typeof INTENSITIES)[number];

export const INTENSITY_LABELS: Record<Intensity, string> = {
  high: "Heavy",
  low: "Light",
};

/**
 * Accumulation & Intensification periodization: whole WEEKS alternate between
 * accumulation (build volume) and intensification (push intensity).
 */
export const WEEK_FOCUSES = ["accumulation", "intensification"] as const;
export type WeekFocus = (typeof WEEK_FOCUSES)[number];

export const WEEK_FOCUS_LABELS: Record<WeekFocus, string> = {
  accumulation: "Accumulation",
  intensification: "Intensification",
};

export const PROGRESSION_METHODS = ["intra", "inter"] as const;
export type ProgressionMethod = (typeof PROGRESSION_METHODS)[number];

export const FEEDBACK_TYPES = ["bug", "idea", "praise", "other"] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];
export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  bug: "Something's broken",
  idea: "Idea or request",
  praise: "Praise",
  other: "Other",
};

/** How an exercise is measured: repetitions, or seconds of hold. */
export const MEASUREMENTS = ["reps", "time"] as const;
export type Measurement = (typeof MEASUREMENTS)[number];

/**
 * How reps are performed. "cluster" is for eccentric-style work: one set is
 * several cluster reps with a short rest between each rep, plus the normal
 * rest between sets.
 */
export const REP_STYLES = ["standard", "cluster"] as const;
export type RepStyle = (typeof REP_STYLES)[number];

/**
 * Training modes an exercise (or a run of exercises) can be performed in.
 * Superset needs at least two exercises; every other mode works with one.
 */
export const GROUP_TYPES = [
  "superset",
  "circuit",
  "pyramid",
  "hiit",
  "ladder",
  "to_failure",
] as const;
export type GroupType = (typeof GROUP_TYPES)[number];

/** Areas the athlete sets goals for when creating a program. */
export const GOAL_AREAS = [
  "skills",
  "push",
  "pull",
  "flexibility",
  "other",
] as const;
export type GoalArea = (typeof GOAL_AREAS)[number];

/**
 * Inter-exercise progression techniques are a fixed taxonomy, each with its
 * own logging UI:
 * - "notes" techniques capture a free-text measurement,
 * - "hybrid" lets the athlete pick a progression per set,
 * - "hybrid_eccentric" splits each set into dynamic + eccentric reps.
 */
export type TechniqueKind = "notes" | "hybrid" | "hybrid_eccentric";

export type InterTechniqueDef = {
  id: string;
  name: string;
  kind: TechniqueKind;
  description: string;
  /** Placeholder/prompt for the notes input (notes kind only). */
  prompt?: string;
};

export const INTER_TECHNIQUES: InterTechniqueDef[] = [
  {
    id: "assistance",
    name: "Assistance",
    kind: "notes",
    description:
      "Use a measurable assistance tool and reduce it over time (band strength, counterweight, foot support).",
    prompt:
      "Which assistance did you use? e.g. green band, 10kg counterweight…",
  },
  {
    id: "eccentric",
    name: "Eccentric",
    kind: "notes",
    description:
      "Perform only the lowering phase, slow and controlled; progress by slowing down or adding reps.",
    prompt: "Rest between reps? e.g. 20s between eccentrics…",
  },
  {
    id: "momentum-rom",
    name: "Momentum & Extra ROM",
    kind: "notes",
    description:
      "Use a little swing or extra range to get through the sticking point; reduce it as you get stronger.",
    prompt: "How much momentum / extra range? e.g. small kip, +10cm ROM…",
  },
  {
    id: "modification",
    name: "Exercise modification",
    kind: "notes",
    description:
      "Change the exercise slightly to make it achievable (grip, angle, tempo).",
    prompt: "What did you modify? e.g. wide grip, paused at top…",
  },
  {
    id: "hybrid",
    name: "Hybrid sets",
    kind: "hybrid",
    description:
      "Mix progressions within the exercise: pick which progression you performed for every set.",
  },
  {
    id: "hybrid-eccentric",
    name: "Hybrid sets with eccentrics",
    kind: "hybrid_eccentric",
    description:
      "In each set, do your dynamic reps first, then finish with eccentric-only reps (e.g. 1 L-pull-up + 4 eccentrics).",
  },
];

export const TECHNIQUES_BY_ID = new Map(INTER_TECHNIQUES.map((t) => [t.id, t]));

export const MIN_WEEKS = 6;
export const MAX_WEEKS = 8;

// ---------------------------------------------------------------------------
// Labels

export const CATEGORY_LABELS: Record<Category, string> = {
  push: "Push",
  pull: "Pull",
  both: "Push & Pull",
  legs: "Legs",
};

export const ATTRIBUTE_LABELS: Record<Attribute, string> = {
  warmup: "Warm-up",
  skill: "Skill",
  strength: "Strength",
  prehabilitation: "Prehabilitation",
  isolation: "Isolation",
  flexibility: "Flexibility",
  cooldown: "Cool-down",
};

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

export const WEEKDAY_SHORT: Record<Weekday, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

export const PROGRAM_TYPE_LABELS: Record<ProgramType, string> = {
  full_body: "Full Body",
  split: "Split",
  sport_mix: "Mix with a Sport",
};

export const SPLIT_TYPE_LABELS: Record<SplitType, string> = {
  straight_arm_bent_arm: "Straight Arm / Bent Arm",
  push_pull: "Push / Pull",
  upper_lower: "Upper / Lower",
};

export const PERIODIZATION_LABELS: Record<Periodization, string> = {
  none: "Simple",
  daily_undulating: "Accumulation & Intensification",
  high_low: "Light / Heavy",
};

export const MEASUREMENT_LABELS: Record<Measurement, string> = {
  reps: "Reps",
  time: "Hold time (seconds)",
};

export const REP_STYLE_LABELS: Record<RepStyle, string> = {
  standard: "Standard",
  cluster: "Cluster reps (eccentrics)",
};

export const GROUP_TYPE_LABELS: Record<GroupType, string> = {
  superset: "Superset",
  circuit: "Circuit",
  pyramid: "Pyramid",
  hiit: "HIIT",
  ladder: "Ladder",
  to_failure: "To-Failure",
};

/** One distinct colour per mode (left border + badge tint). */
export const GROUP_TYPE_COLORS: Record<
  GroupType,
  { border: string; badge: string }
> = {
  superset: {
    border: "border-l-violet-500",
    badge: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  },
  circuit: {
    border: "border-l-emerald-500",
    badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
  pyramid: {
    border: "border-l-amber-500",
    badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  hiit: {
    border: "border-l-red-500",
    badge: "bg-red-500/15 text-red-600 dark:text-red-400",
  },
  ladder: {
    border: "border-l-sky-500",
    badge: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  },
  to_failure: {
    border: "border-l-fuchsia-500",
    badge: "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400",
  },
};

export const GOAL_AREA_LABELS: Record<GoalArea, string> = {
  skills: "Skills",
  push: "Push",
  pull: "Pull",
  flexibility: "Flexibility",
  other: "Other",
};
