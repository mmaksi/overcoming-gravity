"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { getStore } from "@/lib/data";
import {
  defaultTemplateSchema,
  exerciseSchema,
} from "@/lib/domain/schemas";

function revalidateContent() {
  revalidatePath("/admin", "layout");
  revalidatePath("/programs", "layout");
}

export async function saveExercise(input: unknown): Promise<void> {
  await requireAdmin();
  const exercise = exerciseSchema.parse(input);
  const store = await getStore();
  const all = await store.listExercises();
  const duplicateTitle = all.some(
    (e) =>
      e.id !== exercise.id &&
      e.title.trim().toLowerCase() === exercise.title.trim().toLowerCase(),
  );
  if (duplicateTitle) {
    throw new Error(`An exercise titled "${exercise.title}" already exists`);
  }
  const exists = all.some((e) => e.id === exercise.id);
  if (exists) await store.updateExercise(exercise);
  else await store.createExercise(exercise);
  revalidateContent();
}

export async function removeExercise(id: string): Promise<void> {
  await requireAdmin();
  const store = await getStore();
  const template = await store.getDefaultTemplate();
  if (template.day.exercises.some((e) => e.exerciseId === id)) {
    throw new Error(
      "This exercise is part of the default template — remove it there first",
    );
  }
  await store.deleteExercise(id);
  revalidateContent();
}

export async function saveTemplate(input: unknown): Promise<void> {
  await requireAdmin();
  const template = defaultTemplateSchema.parse(input);
  const store = await getStore();
  await store.saveDefaultTemplate(template);
  revalidateContent();
}

