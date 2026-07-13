"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getStore } from "@/lib/data";
import {
  getCachedDefaultTemplate,
  getCachedExercises,
} from "@/lib/data/cached";
import { weekdayOf, toISODate } from "@/lib/domain/schedule";
import { buildDefaultWorkoutDay } from "@/lib/domain/defaults";
import {
  CustomWorkout,
  customWorkoutSchema,
  WorkoutSession,
  workoutDaySchema,
} from "@/lib/domain/schemas";

/**
 * Create a standalone workout prefilled from the admin defaults (same
 * structure as a program day — no goals, no periodization) and jump into
 * its editor.
 */
export async function createCustomWorkout(): Promise<void> {
  const user = await requireUser();
  const store = await getStore();
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
  revalidatePath("/programs");
  redirect(`/workouts/${workout.id}`);
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
  await store.updateCustomWorkout(
    customWorkoutSchema.parse({
      ...workout,
      title: parsed.title,
      day: parsed.day,
      updatedAt: new Date().toISOString(),
    }),
  );
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
  revalidatePath("/programs");
}

/**
 * Do a custom workout now: reuse today's unfinished session for it if one
 * exists, otherwise create one, then open the logger.
 */
export async function startCustomWorkout(id: string): Promise<void> {
  const user = await requireUser();
  const store = await getStore();
  const workout = await store.getCustomWorkout(id);
  if (!workout || workout.userId !== user.id) {
    throw new Error("Workout not found");
  }
  const today = toISODate(new Date());
  const existing = (
    await store.listSessionsByUser(user.id, today, today)
  ).find((s) => s.customWorkoutId === id && s.status === "planned");
  if (existing) redirect(`/workout/${existing.id}`);

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
  revalidatePath("/", "layout");
  redirect(`/workout/${session.id}`);
}
