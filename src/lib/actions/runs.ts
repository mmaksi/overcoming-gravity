"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getStore } from "@/lib/data";
import {
  userDashboardTag,
  userHistoryTag,
  userProgramsTag,
} from "@/lib/data/cached";
import { generateSessions } from "@/lib/domain/schedule";
import { ProgramRun, sessionEntrySchema } from "@/lib/domain/schemas";

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
  updateTag(userDashboardTag(user.id));
  revalidatePath("/");
  // The caller navigates home. A server redirect() thrown here would be
  // swallowed when this action is invoked from a TanStack Query mutation
  // (outside a React transition), so navigation stays on the client.
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
  updateTag(userDashboardTag(user.id));
  revalidatePath("/");
}

export async function abandonRun(runId: string): Promise<void> {
  const user = await requireUser();
  const store = await getStore();
  const run = await store.getRun(runId);
  if (!run || run.userId !== user.id) throw new Error("Run not found");
  await store.updateRun({ ...run, status: "abandoned" });
  await store.deletePlannedSessions(run.id);
  updateTag(userProgramsTag(user.id));
  updateTag(userDashboardTag(user.id));
  revalidatePath("/");
}

const saveSessionSchema = z.object({
  sessionId: z.string(),
  entries: z.array(sessionEntrySchema),
  action: z.enum(["save", "complete", "skip"]),
  /** How long the workout took: wall time, time in other apps included. */
  durationSeconds: z.number().int().min(0).optional(),
});

/**
 * Write a session to the server. Only ever called from an explicit "Save
 * progress" / "Complete workout" / "Skip" — while training, the athlete's log
 * lives on their device (see components/workout/session-storage.ts). There is
 * deliberately no background autosave: any `revalidatePath` here makes the
 * action's response carry a full re-render of the workout page, and a
 * backgrounded PWA has that stream cut mid-flight, which crashed the logger.
 * Every call below therefore happens with the app in the foreground.
 */
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

  // Notes belong to the user + exercise progression, so they resurface every
  // time that specific progression is trained (mid-workout progression swaps
  // are captured because the entry carries the progression actually performed).
  // One bulk upsert.
  const now = new Date().toISOString();
  await store.saveExerciseNotes(
    entries
      .filter((entry) => entry.notes?.trim())
      .map((entry) => ({
        userId: user.id,
        exerciseId: entry.exerciseId,
        progressionId: entry.progressionId,
        note: entry.notes!.trim(),
        updatedAt: now,
      })),
  );
  // Clearing a note's text forgets the remembered note (an emptied note is
  // upserted by nothing above, so without this its old text would linger).
  // Entries not in this session are untouched, so notes for other
  // progressions still resurface.
  await store.deleteExerciseNotes(
    entries
      .filter((entry) => !entry.notes?.trim())
      .map((entry) => ({
        userId: user.id,
        exerciseId: entry.exerciseId,
        progressionId: entry.progressionId,
      })),
  );

  // A run is finished once no planned sessions remain. Custom-workout
  // sessions have no run to complete.
  let runCompleted = false;
  let programId: string | null = null;
  if (action !== "save" && session.runId) {
    const run = await store.getRun(session.runId);
    if (run && run.status === "active") {
      programId = run.programId;
      // Summaries: the check only reads statuses, never performed sets.
      const sessions = await store.listSessionSummariesByRun(run.id);
      if (sessions.every((s) => s.status !== "planned")) {
        await store.updateRun({ ...run, status: "completed" });
        runCompleted = true;
      }
    }
  }

  updateTag(userDashboardTag(user.id));
  if (action !== "save") {
    // The workout just entered (or left) the completed history.
    updateTag(userHistoryTag(user.id));
  }
  if (runCompleted) updateTag(userProgramsTag(user.id));
  revalidatePath("/");
  // The calendar renders both the month grid and the history feed. Its
  // client Router Cache entry lives a full day (staleTimes), so without an
  // explicit bust an edited or freshly completed workout keeps showing the
  // stale render on the next visit.
  revalidatePath("/calendar");
  // This session's own page too: leaving mid-workout via "Save progress" and
  // coming back must not replay the router-cached render from before the save.
  revalidatePath(`/workout/${sessionId}`);
  return { runCompleted, programId };
}

const rememberNoteSchema = z.object({
  exerciseId: z.string(),
  progressionId: z.string(),
  note: z.string().trim().min(1).max(4000),
});

/**
 * Persist one progression's remembered note immediately. The logger calls
 * this when the athlete swaps progression mid-workout with a note typed for
 * the progression they're leaving — the session save only carries the note of
 * the progression the entry ends on, so without this the just-typed note
 * would be lost (or, before the per-progression fix, wrongly re-saved under
 * every progression the athlete flipped through).
 */
export async function rememberExerciseNote(input: {
  exerciseId: string;
  progressionId: string;
  note: string;
}): Promise<void> {
  const user = await requireUser();
  const parsed = rememberNoteSchema.parse(input);
  const store = await getStore();
  await store.saveExerciseNotes([
    {
      userId: user.id,
      exerciseId: parsed.exerciseId,
      progressionId: parsed.progressionId,
      note: parsed.note,
      updatedAt: new Date().toISOString(),
    },
  ]);
  // No cache tags: remembered notes are read per-request on the workout page.
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
  // Completed counts / progress bars on the home cards include this session.
  updateTag(userDashboardTag(user.id));
  revalidatePath("/");
  // The calendar's day-long client Router Cache would otherwise keep showing
  // the deleted workout on both the grid and the history feed.
  revalidatePath("/calendar");
}
