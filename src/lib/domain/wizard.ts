import { z } from "zod";
import {
  MAX_WEEKS,
  MIN_WEEKS,
  PERIODIZATIONS,
  PROGRAM_TYPES,
  SPLIT_TYPES,
  WEEKDAYS,
} from "./types";
import { goalsSchema, sportSchema } from "./schemas";

/** What the create-program wizard collects in steps 1–4. */
export const wizardPayloadSchema = z
  .object({
    name: z.string().min(1).max(80),
    type: z.enum(PROGRAM_TYPES),
    splitType: z.enum(SPLIT_TYPES).optional(),
    sport: sportSchema.optional(),
    goals: goalsSchema,
    periodization: z.enum(PERIODIZATIONS),
    trainingDays: z.array(z.enum(WEEKDAYS)).min(1),
    weeks: z.number().int().min(MIN_WEEKS).max(MAX_WEEKS),
  })
  .refine((p) => p.type !== "split" || p.splitType !== undefined, {
    message: "Split programs must choose a split type",
  })
  .refine((p) => p.type !== "sport_mix" || p.sport !== undefined, {
    message: "Sport-mix programs must define the sport",
  });

export type WizardPayload = z.infer<typeof wizardPayloadSchema>;
