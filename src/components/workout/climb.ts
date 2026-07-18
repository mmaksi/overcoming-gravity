/**
 * Step logic for the ladder / pyramid runner, kept pure so it is testable
 * without the timer UI around it.
 *
 * Both modes "climb": each step is one interval of the clock. The athlete
 * performs the step's target reps and rests for whatever remains of the
 * interval. A ladder climbs up (start, start+inc, …) until the athlete
 * can't complete a step — every completed step is a set. A pyramid does the
 * same, then climbs back down from one increment below the last completed
 * step to the start value.
 */

export type ClimbType = "pyramid" | "ladder";

export type ClimbSettings = {
  /** Reps of the first step (the "1" in 1, 2, 3…). */
  startReps: number;
  /** How many reps each step adds on the way up (and removes going down). */
  increment: number;
  /** Length of each step's interval; leftover time after the reps is rest. */
  intervalSeconds: number;
};

export const DEFAULT_CLIMB_SETTINGS: ClimbSettings = {
  startReps: 1,
  increment: 1,
  intervalSeconds: 60,
};

export type ClimbState = {
  /** Reps of every completed step, in order — one set each. */
  completed: number[];
  /** The current step's target reps. */
  target: number;
  /** Pyramids descend after the first failure; ladders only go up. */
  direction: "up" | "down";
  /** No more steps: the result is ready to be recorded. */
  finished: boolean;
};

export function startClimb(settings: ClimbSettings): ClimbState {
  return {
    completed: [],
    target: Math.max(1, settings.startReps),
    direction: "up",
    finished: false,
  };
}

/** The athlete finished the current step's reps. */
export function completeStep(
  state: ClimbState,
  settings: ClimbSettings,
): ClimbState {
  if (state.finished) return state;
  const completed = [...state.completed, state.target];
  if (state.direction === "up") {
    return { ...state, completed, target: state.target + settings.increment };
  }
  // Descending: the climb ends once the start value has been performed.
  if (state.target <= Math.max(1, settings.startReps)) {
    return { ...state, completed, finished: true };
  }
  return { ...state, completed, target: state.target - settings.increment };
}

/**
 * The athlete couldn't complete the current step. A ladder (or a pyramid
 * already descending) is over; a pyramid on the way up turns around and
 * climbs down from one increment below its last completed step.
 */
export function failStep(
  state: ClimbState,
  type: ClimbType,
  settings: ClimbSettings,
): ClimbState {
  if (state.finished) return state;
  if (type === "ladder" || state.direction === "down") {
    return { ...state, finished: true };
  }
  const last = state.completed[state.completed.length - 1];
  const down = last !== undefined ? last - settings.increment : 0;
  // Nothing left to descend through (failed the very first step, or the
  // only completed step was the start value).
  if (last === undefined || down < Math.max(1, settings.startReps)) {
    return { ...state, finished: true };
  }
  return { ...state, direction: "down", target: down };
}

/** Total volume of the run so far. */
export function totalReps(state: ClimbState): number {
  return state.completed.reduce((n, r) => n + r, 0);
}
