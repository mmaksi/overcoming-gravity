"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getStore } from "@/lib/data";
import { userStatsTag } from "@/lib/data/cached";
import { BodyweightEntry } from "@/lib/domain/schemas";

const inputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weightKg: z.number().positive().max(1000),
});

/** Record (or overwrite) the weigh-in for a given day. */
export async function saveBodyweight(input: {
  date: string;
  weightKg: number;
}): Promise<void> {
  const user = await requireUser();
  const { date, weightKg } = inputSchema.parse(input);
  const store = await getStore();
  const entry: BodyweightEntry = {
    id: crypto.randomUUID(),
    userId: user.id,
    date,
    weightKg,
    createdAt: new Date().toISOString(),
  };
  await store.saveBodyweightEntry(entry);
  updateTag(userStatsTag(user.id));
  revalidatePath("/");
  revalidatePath("/settings");
}

export async function deleteBodyweight(id: string): Promise<void> {
  const user = await requireUser();
  const store = await getStore();
  await store.deleteBodyweightEntry(id);
  updateTag(userStatsTag(user.id));
  revalidatePath("/");
  revalidatePath("/settings");
}
