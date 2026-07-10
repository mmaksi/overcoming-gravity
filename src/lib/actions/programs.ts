"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getStore } from "@/lib/data";
import { Mesocycle, mesocycleSchema, Program } from "@/lib/domain/schemas";
import { buildMesocycle } from "@/lib/domain/build";
import { WizardPayload, wizardPayloadSchema } from "@/lib/domain/wizard";
import { DataStore } from "@/lib/data/store";

/**
 * Notes typed against an inter-exercise technique belong to the user +
 * exercise + technique, not to one workout or program — remember the latest
 * one so it can prefill everywhere that pair is picked again.
 */
async function rememberMesocycleNotes(
  store: DataStore,
  userId: string,
  mesocycle: Mesocycle,
): Promise<void> {
  const latest = new Map<string, { exerciseId: string; techniqueId: string; note: string }>();
  for (const week of mesocycle.weeks) {
    for (const day of Object.values(week.days)) {
      for (const we of day?.exercises ?? []) {
        if (we.interTechniqueId && we.notes?.trim()) {
          latest.set(`${we.exerciseId}:${we.interTechniqueId}`, {
            exerciseId: we.exerciseId,
            techniqueId: we.interTechniqueId,
            note: we.notes.trim(),
          });
        }
      }
    }
  }
  const now = new Date().toISOString();
  for (const { exerciseId, techniqueId, note } of latest.values()) {
    await store.saveExerciseNote({
      userId,
      exerciseId,
      techniqueId,
      note,
      updatedAt: now,
    });
  }
}

export async function createProgramFromWizard(
  payload: WizardPayload,
): Promise<void> {
  const user = await requireUser();
  const parsed = wizardPayloadSchema.parse(payload);
  const store = await getStore();

  const [template, exercises] = await Promise.all([
    store.getDefaultTemplate(),
    store.listExercises(),
  ]);

  const now = new Date().toISOString();
  const program: Program = {
    id: crypto.randomUUID(),
    userId: user.id,
    name: parsed.name,
    type: parsed.type,
    splitType: parsed.type === "split" ? parsed.splitType : undefined,
    sport: parsed.type === "sport_mix" ? parsed.sport : undefined,
    goals: parsed.goals,
    periodization: parsed.periodization,
    weeks: parsed.weeks,
    trainingDays: parsed.trainingDays,
    mesocycle: buildMesocycle({
      weeks: parsed.weeks,
      trainingDays: parsed.trainingDays,
      periodization: parsed.periodization,
      template,
      exercises,
    }),
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };

  await store.createProgram(program);
  revalidatePath("/programs");
  redirect(`/programs/${program.id}/design`);
}

const saveMesocycleSchema = z.object({
  programId: z.string(),
  mesocycle: mesocycleSchema,
});

export async function saveMesocycle(input: {
  programId: string;
  mesocycle: unknown;
}): Promise<{ savedAt: string }> {
  const user = await requireUser();
  const { programId, mesocycle } = saveMesocycleSchema.parse(input);
  const store = await getStore();
  const program = await store.getProgram(programId);
  if (!program || program.userId !== user.id) {
    throw new Error("Program not found");
  }
  const updated: Program = {
    ...program,
    mesocycle,
    updatedAt: new Date().toISOString(),
  };
  await store.updateProgram(updated);
  await rememberMesocycleNotes(store, user.id, updated.mesocycle);
  return { savedAt: updated.updatedAt };
}

export async function activateProgram(programId: string): Promise<void> {
  const user = await requireUser();
  const store = await getStore();
  const program = await store.getProgram(programId);
  if (!program || program.userId !== user.id) {
    throw new Error("Program not found");
  }
  await store.updateProgram({
    ...program,
    status: "active",
    updatedAt: new Date().toISOString(),
  });
  revalidatePath("/programs");
  redirect(`/programs/${programId}`);
}

export async function deleteProgram(programId: string): Promise<void> {
  const user = await requireUser();
  const store = await getStore();
  const program = await store.getProgram(programId);
  if (!program || program.userId !== user.id) {
    throw new Error("Program not found");
  }
  await store.deleteProgram(programId);
  revalidatePath("/programs");
  redirect("/programs");
}
