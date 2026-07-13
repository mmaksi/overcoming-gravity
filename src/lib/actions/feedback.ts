"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getStore } from "@/lib/data";
import { Feedback } from "@/lib/domain/schemas";
import { FEEDBACK_TYPES } from "@/lib/domain/types";

const inputSchema = z.object({
  type: z.enum(FEEDBACK_TYPES),
  message: z.string().trim().min(1).max(4000),
});

/** Store feedback in the database (tagged by type) instead of emailing it. */
export async function submitFeedback(input: {
  type: string;
  message: string;
}): Promise<void> {
  const user = await requireUser();
  const { type, message } = inputSchema.parse(input);
  const store = await getStore();
  const feedback: Feedback = {
    id: crypto.randomUUID(),
    userId: user.id,
    type,
    message,
    createdAt: new Date().toISOString(),
  };
  await store.createFeedback(feedback);
}
