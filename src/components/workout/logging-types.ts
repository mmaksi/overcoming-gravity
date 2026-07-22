import type { Measurement } from "@/lib/domain/types";

/** One progression-slice of a hybrid set. */
export type RawPart = { progressionId: string; reps: string };

/** Editable raw inputs: empty string = "not recorded yet". */
export type RawSet = {
  reps: string;
  weight: string;
  /** Marked finished by the athlete — starts the rest timer. */
  done: boolean;
  /** Hybrid sets: reps per progression inside this one set. */
  parts: RawPart[];
  /** Hybrid + eccentrics: eccentric reps after the dynamic ones. */
  eccentricReps: string;
};

/** The athlete's in-progress log for one planned exercise. */
export type EntryState = {
  workoutExerciseId: string;
  exerciseId: string;
  progressionId: string;
  interTechniqueId?: string;
  notes?: string;
  /** The unit the athlete is logging in — switchable mid-workout. */
  measurement?: Measurement;
  sets: RawSet[];
};
