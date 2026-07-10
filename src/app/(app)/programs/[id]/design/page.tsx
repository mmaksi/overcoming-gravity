import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getStore } from "@/lib/data";
import { exerciseNoteKey } from "@/lib/domain/schemas";
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

  const [exercises, notes] = await Promise.all([
    store.listExercises(),
    store.listExerciseNotes(user.id),
  ]);
  const userNotes = Object.fromEntries(
    notes.map((n) => [exerciseNoteKey(n.exerciseId, n.techniqueId), n.note]),
  );

  return (
    <MesocycleDesigner
      program={program}
      exercises={exercises}
      userNotes={userNotes}
    />
  );
}
