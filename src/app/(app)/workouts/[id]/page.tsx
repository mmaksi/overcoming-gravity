import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getStore } from "@/lib/data";
import { WorkoutEditor } from "@/components/workouts/workout-editor";

export default async function CustomWorkoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const store = await getStore();

  const workout = await store.getCustomWorkout(id);
  if (!workout || workout.userId !== user.id) notFound();

  const exercises = await store.listExercises();

  return <WorkoutEditor workout={workout} exercises={exercises} />;
}
