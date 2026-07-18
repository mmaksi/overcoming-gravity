"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { getStore } from "@/lib/data";
import {
  DEFAULT_TEMPLATE_TAG,
  EXERCISES_TAG,
} from "@/lib/data/cached";
import {
  defaultTemplateSchema,
  exerciseSchema,
  voucherSchema,
} from "@/lib/domain/schemas";

function revalidateContent() {
  // Bust the long-lived content cache and the pages that render it.
  revalidateTag(EXERCISES_TAG, "max");
  revalidateTag(DEFAULT_TEMPLATE_TAG, "max");
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

// Vouchers -------------------------------------------------------------------

const createVoucherSchema = voucherSchema.pick({
  code: true,
  percentOff: true,
  validFrom: true,
  validUntil: true,
  maxRedemptions: true,
});

/** Create a discount code (admin). Codes are stored uppercase. */
export async function createVoucher(input: {
  code: string;
  percentOff: number;
  validFrom?: string;
  validUntil?: string;
  maxRedemptions?: number;
}): Promise<void> {
  await requireAdmin();
  const parsed = createVoucherSchema.parse(input);
  if (parsed.validFrom && parsed.validUntil && parsed.validUntil < parsed.validFrom) {
    throw new Error("The voucher would expire before it starts");
  }
  const store = await getStore();
  await store.createVoucher({
    id: crypto.randomUUID(),
    ...parsed,
    redemptions: 0,
    createdAt: new Date().toISOString(),
  });
  revalidatePath("/admin/vouchers");
}

export async function removeVoucher(id: string): Promise<void> {
  await requireAdmin();
  const store = await getStore();
  await store.deleteVoucher(id);
  revalidatePath("/admin/vouchers");
}

