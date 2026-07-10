"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getStore } from "@/lib/data";
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

  // One active run at a time: starting a program ends any other run and
  // clears its not-yet-done sessions so the calendar stays honest.
  const existing = await store.listRuns(user.id);
  for (const other of existing.filter((r) => r.status === "active")) {
    await store.updateRun({ ...other, status: "abandoned" });
    await store.deletePlannedSessions(other.id);
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
  revalidatePath("/", "layout");
  redirect("/");
}

export async function abandonRun(runId: string): Promise<void> {
  const user = await requireUser();
  const store = await getStore();
  const run = await store.getRun(runId);
  if (!run || run.userId !== user.id) throw new Error("Run not found");
  await store.updateRun({ ...run, status: "abandoned" });
  await store.deletePlannedSessions(run.id);
  revalidatePath("/", "layout");
}

const saveSessionSchema = z.object({
  sessionId: z.string(),
  entries: z.array(sessionEntrySchema),
  action: z.enum(["save", "complete", "skip"]),
});

export async function saveWorkoutSession(input: {
  sessionId: string;
  entries: unknown;
  action: "save" | "complete" | "skip";
}): Promise<{ runCompleted: boolean; programId: string | null }> {
  const user = await requireUser();
  const { sessionId, entries, action } = saveSessionSchema.parse(input);
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
  await store.updateSession({ ...session, entries, status });

  // A run is finished once no planned sessions remain.
  let runCompleted = false;
  let programId: string | null = null;
  if (action !== "save") {
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

  revalidatePath("/", "layout");
  return { runCompleted, programId };
}
