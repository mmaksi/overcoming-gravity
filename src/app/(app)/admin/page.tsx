import { getStore } from "@/lib/data";
import { ExercisesManager } from "@/components/admin/exercises-manager";

export default async function AdminExercisesPage() {
  const store = await getStore();
  const exercises = await store.listExercises();
  return <ExercisesManager exercises={exercises} />;
}
