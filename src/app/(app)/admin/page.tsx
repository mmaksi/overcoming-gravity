import { getStore } from "@/lib/data";
import { ExercisesManager } from "@/components/admin/exercises-manager";

export default async function AdminExercisesPage() {
  const store = await getStore();
  const [exercises, sports] = await Promise.all([
    store.listExercises(),
    store.listSports(),
  ]);
  return <ExercisesManager exercises={exercises} sports={sports} />;
}
