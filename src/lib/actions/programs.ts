"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getStore } from "@/lib/data";
import { GoalItem, mesocycleSchema, Program } from "@/lib/domain/schemas";
import { GOAL_AREAS, GoalArea } from "@/lib/domain/types";
import { buildMesocycle } from "@/lib/domain/build";
import { WizardPayload, wizardPayloadSchema } from "@/lib/domain/wizard";

const asGoalItems = (texts: string[]): GoalItem[] =>
  texts.map((text) => ({ text, done: false }));

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
    goals: {
      skills: asGoalItems(parsed.goals.skills),
      push: asGoalItems(parsed.goals.push),
      pull: asGoalItems(parsed.goals.pull),
    },
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

const toggleGoalSchema = z.object({
  programId: z.string(),
  area: z.enum(GOAL_AREAS),
  index: z.number().int().min(0),
  done: z.boolean(),
});

/** Tick / untick one program goal from the dashboard. */
export async function toggleProgramGoal(input: {
  programId: string;
  area: GoalArea;
  index: number;
  done: boolean;
}): Promise<void> {
  const user = await requireUser();
  const { programId, area, index, done } = toggleGoalSchema.parse(input);
  const store = await getStore();
  const program = await store.getProgram(programId);
  if (!program || program.userId !== user.id) {
    throw new Error("Program not found");
  }
  if (!program.goals || !program.goals[area][index]) return;
  const goals = {
    ...program.goals,
    [area]: program.goals[area].map((g, i) =>
      i === index ? { ...g, done } : g,
    ),
  };
  await store.updateProgram({
    ...program,
    goals,
    updatedAt: new Date().toISOString(),
  });
  revalidatePath("/", "layout");
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
