import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getStore } from "@/lib/data";
import { getCachedFinishedSessions } from "@/lib/data/cached";
import { workoutStreak } from "@/lib/domain/streak";
import { CongratsCard } from "@/components/workout/congrats-card";

/**
 * Post-workout celebration: the logger navigates here after "Complete
 * workout". Shows the streak (when there is one) and returns home.
 */
export default async function WorkoutCongratsPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const user = await requireUser();
  const store = await getStore();

  const session = await store.getSession(sessionId);
  // Only celebrate a workout this user actually completed.
  if (!session || session.userId !== user.id || session.status !== "completed") {
    redirect("/");
  }

  // Completing the workout busted the history tag, so this read is fresh and
  // already includes the session being celebrated.
  const finished = await getCachedFinishedSessions(store, user.id);
  const streak = workoutStreak(finished);
  const totalWorkouts = finished.filter((s) => s.status === "completed").length;

  return (
    <CongratsCard
      name={user.name}
      streak={streak}
      totalWorkouts={totalWorkouts}
      durationSeconds={session.durationSeconds}
    />
  );
}
