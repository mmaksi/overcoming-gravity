import { z } from "zod";
import {
  MAX_WEEKS,
  MIN_WEEKS,
  PERIODIZATIONS,
  PROGRAM_TYPES,
  SPLIT_TYPES,
  WEEKDAYS,
} from "./types";
import { sportSchema } from "./schemas";

/** Goals arrive from the wizard as plain strings; one in total is enough. */
const wizardGoalAreaSchema = z.array(z.string().min(1)).max(2).default([]);
const wizardGoalsSchema = z
  .object({
    skills: wizardGoalAreaSchema,
    push: wizardGoalAreaSchema,
    pull: wizardGoalAreaSchema,
    flexibility: wizardGoalAreaSchema,
    other: wizardGoalAreaSchema,
  })
  .refine(
    (g) =>
      g.skills.length +
        g.push.length +
        g.pull.length +
        g.flexibility.length +
        g.other.length >=
      1,
    { message: "Define at least one goal" },
  );

/** What the create-program wizard collects in steps 1–4. */
export const wizardPayloadSchema = z
  .object({
    name: z.string().min(1).max(80),
    type: z.enum(PROGRAM_TYPES),
    splitType: z.enum(SPLIT_TYPES).optional(),
    sport: sportSchema.optional(),
    goals: wizardGoalsSchema,
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
