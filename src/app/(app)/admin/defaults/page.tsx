import { getStore } from "@/lib/data";
import {
  getCachedDefaultTemplate,
  getCachedExercises,
} from "@/lib/data/cached";
import { DefaultsManager } from "@/components/admin/defaults-manager";

export default async function AdminDefaultsPage() {
  const store = await getStore();
  const [template, exercises] = await Promise.all([
    getCachedDefaultTemplate(store),
    getCachedExercises(store),
  ]);
  return <DefaultsManager template={template} exercises={exercises} />;
}
