import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getStore } from "@/lib/data";
import { MesocycleDesigner } from "@/components/designer/mesocycle-designer";

export default async function DesignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const store = await getStore();

  const program = await store.getProgram(id);
  if (!program || program.userId !== user.id) notFound();

  const exercises = await store.listExercises();

  return <MesocycleDesigner program={program} exercises={exercises} />;
}
