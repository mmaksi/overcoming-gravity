"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getStore } from "@/lib/data";
import {
  getCachedDefaultTemplate,
  getCachedExercises,
  userProgramsTag,
} from "@/lib/data/cached";
import { weekdayOf, toISODate } from "@/lib/domain/schedule";
import {
  FREE_CUSTOM_WORKOUT_LIMIT,
  isPro,
} from "@/lib/billing/entitlements";
import { buildDefaultWorkoutDay } from "@/lib/domain/defaults";
import {
  CustomWorkout,
  customWorkoutSchema,
  normalizeWorkoutDay,
  WorkoutSession,
  workoutDaySchema,
} from "@/lib/domain/schemas";

/**
 * Create a standalone workout prefilled from the admin defaults (same
 * structure as a program day — no goals, no periodization). Returns the new
 * workout's id; the caller navigates to its editor (a server-side redirect
 * here would race the immediate refresh `updateTag` triggers on /programs,
 * the page this is invoked from).
 */
export async function createCustomWorkout(): Promise<string> {
  const user = await requireUser();
  const store = await getStore();
  // Free accounts get a taste: the UI paywalls beyond the limit, and this
  // backstops direct calls.
  if (!isPro(user)) {
    const existing = await store.listCustomWorkouts(user.id);
    if (existing.length >= FREE_CUSTOM_WORKOUT_LIMIT) {
      throw new Error(
        `The free plan includes ${FREE_CUSTOM_WORKOUT_LIMIT} custom workouts — upgrade for unlimited.`,
      );
    }
  }
  const [template, exercises] = await Promise.all([
    getCachedDefaultTemplate(store),
    getCachedExercises(store),
  ]);
  const now = new Date().toISOString();
  const workout: CustomWorkout = {
    id: crypto.randomUUID(),
    userId: user.id,
    title: "My workout",
    day: buildDefaultWorkoutDay(
      template,
      new Map(exercises.map((e) => [e.id, e])),
    ),
    createdAt: now,
    updatedAt: now,
  };
  await store.createCustomWorkout(workout);
  updateTag(userProgramsTag(user.id));
  revalidatePath("/programs");
  return workout.id;
}

const saveWorkoutSchema = z.object({
  id: z.string(),
  title: z.string().trim().min(1).max(80),
  day: workoutDaySchema,
});

export async function saveCustomWorkout(input: {
  id: string;
  title: string;
  day: unknown;
}): Promise<void> {
  const user = await requireUser();
  const parsed = saveWorkoutSchema.parse(input);
  const store = await getStore();
  const workout = await store.getCustomWorkout(parsed.id);
  if (!workout || workout.userId !== user.id) {
    throw new Error("Workout not found");
  }
  // Pin the day to the order the editor displayed — see `normalizeWorkoutDay`.
  const exercises = await getCachedExercises(store);
  const exercisesById = new Map(exercises.map((e) => [e.id, e]));
  await store.updateCustomWorkout(
    customWorkoutSchema.parse({
      ...workout,
      title: parsed.title,
      day: normalizeWorkoutDay(parsed.day, exercisesById),
      updatedAt: new Date().toISOString(),
    }),
  );
  updateTag(userProgramsTag(user.id));
}

/** No redirect — callers navigate (or remove the item optimistically). */
export async function deleteCustomWorkout(id: string): Promise<void> {
  const user = await requireUser();
  const store = await getStore();
  const workout = await store.getCustomWorkout(id);
  if (!workout || workout.userId !== user.id) {
    throw new Error("Workout not found");
  }
  await store.deleteCustomWorkout(id);
  updateTag(userProgramsTag(user.id));
  revalidatePath("/programs");
}

/**
 * Do a custom workout now: reuse today's unfinished session for it if one
 * exists, otherwise create one. Returns the session id; the caller opens the
 * logger (a server redirect() would be swallowed by the TanStack Query
 * mutation this is invoked from — see the client editor).
 */
export async function startCustomWorkout(id: string): Promise<string> {
  const user = await requireUser();
  const store = await getStore();
  const workout = await store.getCustomWorkout(id);
  if (!workout || workout.userId !== user.id) {
    throw new Error("Workout not found");
  }
  const today = toISODate(new Date());
  const existing = (
    await store.listSessionSummariesByUser(user.id, today, today)
  ).find((s) => s.customWorkoutId === id && s.status === "planned");
  if (existing) return existing.id;

  const session: WorkoutSession = {
    id: crypto.randomUUID(),
    customWorkoutId: id,
    userId: user.id,
    date: today,
    weekIndex: 0,
    weekday: weekdayOf(new Date()),
    status: "planned",
    entries: [],
  };
  await store.createSession(session);
  // Custom-workout sessions never show on the home run cards, so no tags.
  revalidatePath("/calendar");
  return session.id;
}
