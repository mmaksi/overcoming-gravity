"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getStore } from "@/lib/data";
import {
  getCachedDefaultTemplate,
  getCachedExercises,
  userDashboardTag,
  userHistoryTag,
  userProgramsTag,
} from "@/lib/data/cached";
import {
  GoalItem,
  Mesocycle,
  mesocycleSchema,
  normalizeWorkoutDay,
  Program,
  Week,
} from "@/lib/domain/schemas";
import { GOAL_AREAS, GoalArea } from "@/lib/domain/types";
import { isPro } from "@/lib/billing/entitlements";
import { buildMesocycle } from "@/lib/domain/build";
import { WizardPayload, wizardPayloadSchema } from "@/lib/domain/wizard";

const asGoalItems = (texts: string[]): GoalItem[] =>
  texts.map((text) => ({ text, done: false }));

/**
 * Create a draft program from the wizard and return its id. The caller
 * navigates to the designer — a server redirect() here would be swallowed by
 * the TanStack Query mutation this runs in (outside a React transition).
 */
export async function createProgramFromWizard(
  payload: WizardPayload,
): Promise<string> {
  const user = await requireUser();
  // The designer is a full-app feature; the UI shows a paywall before ever
  // calling this — the check here backstops direct calls.
  if (!isPro(user)) {
    throw new Error("Creating programs needs the full app — upgrade to continue.");
  }
  const parsed = wizardPayloadSchema.parse(payload);
  const store = await getStore();

  const [template, exercises] = await Promise.all([
    getCachedDefaultTemplate(store),
    getCachedExercises(store),
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
      flexibility: asGoalItems(parsed.goals.flexibility),
      other: asGoalItems(parsed.goals.other),
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
  updateTag(userProgramsTag(user.id));
  revalidatePath("/programs");
  return program.id;
}

const saveMesocycleSchema = z.object({
  programId: z.string(),
  mesocycle: mesocycleSchema,
  /**
   * True only for the explicit "Finish" save. The designer's 1.2s debounced
   * autosave passes false: it persists the draft without expiring any cache
   * (expiring would refresh the designer mid-edit and thrash the caches).
   */
  final: z.boolean().optional(),
});

export async function saveMesocycle(input: {
  programId: string;
  mesocycle: unknown;
  final?: boolean;
}): Promise<{ savedAt: string }> {
  const user = await requireUser();
  const { programId, mesocycle, final } = saveMesocycleSchema.parse(input);
  const store = await getStore();
  const program = await store.getProgram(programId);
  if (!program || program.userId !== user.id) {
    throw new Error("Program not found");
  }
  // Pin every day to the order the designer displayed (explicit sections,
  // canonical array order) so later catalog re-categorization can never
  // reshuffle a designed workout. See `normalizeWorkoutDay`.
  const exercises = await getCachedExercises(store);
  const exercisesById = new Map(exercises.map((e) => [e.id, e]));
  const normalized: Mesocycle = {
    weeks: mesocycle.weeks.map((week): Week => {
      const days: Week["days"] = {};
      for (const [weekday, day] of Object.entries(week.days)) {
        days[weekday as keyof Week["days"]] = day
          ? normalizeWorkoutDay(day, exercisesById)
          : day;
      }
      return { ...week, days };
    }),
  };
  const updated: Program = {
    ...program,
    mesocycle: normalized,
    updatedAt: new Date().toISOString(),
  };
  await store.updateProgram(updated);
  if (final) {
    updateTag(userProgramsTag(user.id));
    // The home cards preview upcoming exercises straight from the mesocycle.
    updateTag(userDashboardTag(user.id));
  }
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
  updateTag(userProgramsTag(user.id));
  revalidatePath("/programs");
  // The caller navigates to the program page (client-side — see the designer).
}

const editGoalAreaSchema = z.array(z.string().trim().min(1)).max(2).default([]);
const editGoalsSchema = z
  .object({
    programId: z.string(),
    goals: z.object({
      skills: editGoalAreaSchema,
      push: editGoalAreaSchema,
      pull: editGoalAreaSchema,
      flexibility: editGoalAreaSchema,
      other: editGoalAreaSchema,
    }),
  })
  .refine((g) => GOAL_AREAS.some((area) => g.goals[area].length > 0), {
    message: "Define at least one goal",
  });

/**
 * Replace a program's goals. A goal keeps its "achieved" tick when its text
 * is unchanged in the same slot; edited or new goals start unticked.
 */
export async function updateProgramGoals(input: {
  programId: string;
  goals: Record<GoalArea, string[]>;
}): Promise<void> {
  const user = await requireUser();
  const parsed = editGoalsSchema.parse(input);
  const store = await getStore();
  const program = await store.getProgram(parsed.programId);
  if (!program || program.userId !== user.id) {
    throw new Error("Program not found");
  }
  const merge = (area: GoalArea): GoalItem[] =>
    parsed.goals[area].map((text, i) => {
      // Legacy programs may miss newer areas entirely, hence the chaining.
      const previous = program.goals?.[area]?.[i];
      return { text, done: previous?.text === text ? previous.done : false };
    });
  await store.updateProgram({
    ...program,
    goals: {
      skills: merge("skills"),
      push: merge("push"),
      pull: merge("pull"),
      flexibility: merge("flexibility"),
      other: merge("other"),
    },
    updatedAt: new Date().toISOString(),
  });
  updateTag(userProgramsTag(user.id));
  updateTag(userDashboardTag(user.id));
  revalidatePath("/");
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
  if (!program.goals?.[area]?.[index]) return;
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
  updateTag(userProgramsTag(user.id));
  // Goal ticks render on the home GoalsCard, fed by the dashboard cache.
  updateTag(userDashboardTag(user.id));
  revalidatePath("/");
}

export async function deleteProgram(programId: string): Promise<void> {
  const user = await requireUser();
  const store = await getStore();
  const program = await store.getProgram(programId);
  if (!program || program.userId !== user.id) {
    throw new Error("Program not found");
  }
  await store.deleteProgram(programId);
  updateTag(userProgramsTag(user.id));
  // Deleting a program cascades its runs' sessions out of history too, and
  // removes its card from the home dashboard.
  updateTag(userHistoryTag(user.id));
  updateTag(userDashboardTag(user.id));
  revalidatePath("/programs");
  // The caller navigates back to /programs (client-side — see the button).
}
