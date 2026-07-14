import { WorkoutSession } from "./schemas";

/**
 * Current workout streak: the number of consecutive **completed** sessions
 * counting back from the most recent finished one, broken by a **skip**.
 *
 * Rest days (dates with no scheduled workout) never count against the streak —
 * only explicitly skipping a scheduled workout resets it. `finished` must be
 * the completed + skipped sessions ordered oldest → newest.
 */
export function workoutStreak(finished: Pick<WorkoutSession, "status">[]): number {
  let streak = 0;
  for (let i = finished.length - 1; i >= 0; i--) {
    if (finished[i].status === "completed") streak++;
    else break; // hit a skip — the streak ends here
  }
  return streak;
}
