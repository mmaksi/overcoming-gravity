"use server";

import { redirect } from "next/navigation";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getStore } from "@/lib/data";
import { userHistoryTag, userProgramsTag } from "@/lib/data/cached";
import { generateSessions } from "@/lib/domain/schedule";
import {
  EXERCISE_NOTE_TECHNIQUE,
  ProgramRun,
  sessionEntrySchema,
} from "@/lib/domain/schemas";

const startRunSchema = z.object({
  programId: z.string(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function startRun(input: {
  programId: string;
  startDate: string;
}): Promise<void> {
  const user = await requireUser();
  const { programId, startDate } = startRunSchema.parse(input);
  const store = await getStore();
  const program = await store.getProgram(programId);
  if (!program || program.userId !== user.id) {
    throw new Error("Program not found");
  }
  if (program.status === "draft") {
    throw new Error("Finish designing the program before starting a run");
  }

  // Several programs can run at the same time, but each program has at most
  // one active run of its own.
  const existing = await store.listRuns(user.id);
  if (existing.some((r) => r.status === "active" && r.programId === programId)) {
    throw new Error("This program is already running");
  }

  const run: ProgramRun = {
    id: crypto.randomUUID(),
    programId,
    userId: user.id,
    startDate,
    status: "active",
    createdAt: new Date().toISOString(),
  };
  const sessions = generateSessions(program, run.id, startDate);
  await store.createRun(run, sessions);
  updateTag(userProgramsTag(user.id));
  revalidatePath("/", "layout");
  redirect("/");
}

/**
 * Restart a program from scratch: the current run is abandoned (its
 * completed workouts stay in history and keep feeding exercise stats) and a
 * fresh run starts today with a clean schedule.
 */
export async function resetRun(runId: string): Promise<void> {
  const user = await requireUser();
  const store = await getStore();
  const run = await store.getRun(runId);
  if (!run || run.userId !== user.id) throw new Error("Run not found");
  const program = await store.getProgram(run.programId);
  if (!program) throw new Error("Program not found");

  await store.updateRun({ ...run, status: "abandoned" });
  await store.deletePlannedSessions(run.id);

  const fresh: ProgramRun = {
    id: crypto.randomUUID(),
    programId: program.id,
    userId: user.id,
    startDate: new Date().toISOString().slice(0, 10),
    status: "active",
    createdAt: new Date().toISOString(),
  };
  const sessions = generateSessions(program, fresh.id, fresh.startDate);
  await store.createRun(fresh, sessions);
  updateTag(userProgramsTag(user.id));
  revalidatePath("/", "layout");
}

export async function abandonRun(runId: string): Promise<void> {
  const user = await requireUser();
  const store = await getStore();
  const run = await store.getRun(runId);
  if (!run || run.userId !== user.id) throw new Error("Run not found");
  await store.updateRun({ ...run, status: "abandoned" });
  await store.deletePlannedSessions(run.id);
  updateTag(userProgramsTag(user.id));
  revalidatePath("/", "layout");
}

const saveSessionSchema = z.object({
  sessionId: z.string(),
  entries: z.array(sessionEntrySchema),
  action: z.enum(["save", "complete", "skip"]),
  /** Accumulated active workout time; the timer pauses between visits. */
  durationSeconds: z.number().int().min(0).optional(),
});

export async function saveWorkoutSession(input: {
  sessionId: string;
  entries: unknown;
  action: "save" | "complete" | "skip";
  durationSeconds?: number;
}): Promise<{ runCompleted: boolean; programId: string | null }> {
  const user = await requireUser();
  const { sessionId, entries, action, durationSeconds } =
    saveSessionSchema.parse(input);
  const store = await getStore();
  const session = await store.getSession(sessionId);
  if (!session || session.userId !== user.id) {
    throw new Error("Session not found");
  }

  const status =
    action === "complete"
      ? "completed"
      : action === "skip"
        ? "skipped"
        : session.status;
  await store.updateSession({
    ...session,
    entries,
    status,
    durationSeconds: durationSeconds ?? session.durationSeconds,
  });

  // Notes belong to the user + exercise (technique-independent) so they
  // resurface every time that exercise is trained.
  const now = new Date().toISOString();
  for (const entry of entries) {
    if (entry.notes?.trim()) {
      await store.saveExerciseNote({
        userId: user.id,
        exerciseId: entry.exerciseId,
        techniqueId: EXERCISE_NOTE_TECHNIQUE,
        note: entry.notes.trim(),
        updatedAt: now,
      });
    }
  }

  // A run is finished once no planned sessions remain. Custom-workout
  // sessions have no run to complete.
  let runCompleted = false;
  let programId: string | null = null;
  if (action !== "save" && session.runId) {
    const run = await store.getRun(session.runId);
    if (run && run.status === "active") {
      programId = run.programId;
      const sessions = await store.listSessionsByRun(run.id);
      if (sessions.every((s) => s.status !== "planned")) {
        await store.updateRun({ ...run, status: "completed" });
        runCompleted = true;
      }
    }
  }

  if (action !== "save") {
    // The workout just entered (or left) the completed history.
    updateTag(userHistoryTag(user.id));
  }
  if (runCompleted) updateTag(userProgramsTag(user.id));
  revalidatePath("/", "layout");
  return { runCompleted, programId };
}

/** Delete a logged workout from history. Does not touch the program plan. */
export async function deleteWorkoutSession(sessionId: string): Promise<void> {
  const user = await requireUser();
  const store = await getStore();
  const session = await store.getSession(sessionId);
  if (!session || session.userId !== user.id) {
    throw new Error("Session not found");
  }
  await store.deleteSession(sessionId);
  updateTag(userHistoryTag(user.id));
  revalidatePath("/", "layout");
}
