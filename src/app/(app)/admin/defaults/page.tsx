import { getStore } from "@/lib/data";
import { DefaultsManager } from "@/components/admin/defaults-manager";

export default async function AdminDefaultsPage() {
  const store = await getStore();
  const [template, exercises] = await Promise.all([
    store.getDefaultTemplate(),
    store.listExercises(),
  ]);
  return <DefaultsManager template={template} exercises={exercises} />;
}
