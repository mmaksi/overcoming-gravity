import { mkdirSync } from "node:fs";
import path from "node:path";
import { JSONFilePreset } from "lowdb/node";
import { Low } from "lowdb";
import {
  DefaultTemplate,
  Exercise,
  ExerciseNote,
  Profile,
  Program,
  ProgramRun,
  WorkoutSession,
} from "@/lib/domain/schemas";
import { DataStore } from "./store";
import { DbData, seedData } from "./seed";

const DB_FILE = path.join(
  process.cwd(),
  process.env.DATA_FILE ?? path.join("data", "db.json"),
);

// Next.js dev compiles routes into separate module graphs, so a plain
// module-level singleton can exist multiple times, each with its own stale
// in-memory copy of the file. Share one instance via globalThis and re-read
// the file before every access so all bundles see each other's writes.
const globalCache = globalThis as unknown as {
  __caliJsonDb?: Promise<Low<DbData>>;
};

async function getDb(): Promise<Low<DbData>> {
  if (!globalCache.__caliJsonDb) {
    mkdirSync(path.dirname(DB_FILE), { recursive: true });
    globalCache.__caliJsonDb = JSONFilePreset<DbData>(DB_FILE, seedData()).then(
      async (db) => {
        // Databases created before exercise notes existed lack the key.
        db.data.exerciseNotes ??= [];
        await db.write(); // materialize the seed on first run
        return db;
      },
    );
    return globalCache.__caliJsonDb;
  }
  const db = await globalCache.__caliJsonDb;
  await db.read();
  // Databases created before exercise notes existed lack the key.
  db.data.exerciseNotes ??= [];
  return db;
}

function upsert<T extends { id: string }>(list: T[], item: T): void {
  const i = list.findIndex((x) => x.id === item.id);
  if (i === -1) list.push(item);
  else list[i] = item;
}

export class JsonStore implements DataStore {
  // Admin-managed content ---------------------------------------------------
  async listExercises(): Promise<Exercise[]> {
    return (await getDb()).data.exercises;
  }
  async getExercise(id: string): Promise<Exercise | null> {
    return (await getDb()).data.exercises.find((e) => e.id === id) ?? null;
  }
  async createExercise(exercise: Exercise): Promise<Exercise> {
    const db = await getDb();
    db.data.exercises.push(exercise);
    await db.write();
    return exercise;
  }
  async updateExercise(exercise: Exercise): Promise<Exercise> {
    const db = await getDb();
    upsert(db.data.exercises, exercise);
    await db.write();
    return exercise;
  }
  async deleteExercise(id: string): Promise<void> {
    const db = await getDb();
    db.data.exercises = db.data.exercises.filter((e) => e.id !== id);
    await db.write();
  }

  async getDefaultTemplate(): Promise<DefaultTemplate> {
    return (await getDb()).data.defaultTemplate;
  }
  async saveDefaultTemplate(template: DefaultTemplate): Promise<DefaultTemplate> {
    const db = await getDb();
    db.data.defaultTemplate = template;
    await db.write();
    return template;
  }


  // User content --------------------------------------------------------------
  async listPrograms(userId: string): Promise<Program[]> {
    const db = await getDb();
    return db.data.programs.filter((p) => p.userId === userId);
  }
  async getProgram(id: string): Promise<Program | null> {
    return (await getDb()).data.programs.find((p) => p.id === id) ?? null;
  }
  async createProgram(program: Program): Promise<Program> {
    const db = await getDb();
    db.data.programs.push(program);
    await db.write();
    return program;
  }
  async updateProgram(program: Program): Promise<Program> {
    const db = await getDb();
    upsert(db.data.programs, program);
    await db.write();
    return program;
  }
  async deleteProgram(id: string): Promise<void> {
    const db = await getDb();
    const runIds = db.data.runs
      .filter((r) => r.programId === id)
      .map((r) => r.id);
    db.data.sessions = db.data.sessions.filter(
      (s) => !runIds.includes(s.runId),
    );
    db.data.runs = db.data.runs.filter((r) => r.programId !== id);
    db.data.programs = db.data.programs.filter((p) => p.id !== id);
    await db.write();
  }

  async listRuns(userId: string): Promise<ProgramRun[]> {
    return (await getDb()).data.runs.filter((r) => r.userId === userId);
  }
  async getRun(id: string): Promise<ProgramRun | null> {
    return (await getDb()).data.runs.find((r) => r.id === id) ?? null;
  }
  async createRun(
    run: ProgramRun,
    sessions: Omit<WorkoutSession, "id">[],
  ): Promise<ProgramRun> {
    const db = await getDb();
    db.data.runs.push(run);
    for (const session of sessions) {
      db.data.sessions.push({ ...session, id: crypto.randomUUID() });
    }
    await db.write();
    return run;
  }
  async updateRun(run: ProgramRun): Promise<ProgramRun> {
    const db = await getDb();
    upsert(db.data.runs, run);
    await db.write();
    return run;
  }

  async deletePlannedSessions(runId: string): Promise<void> {
    const db = await getDb();
    db.data.sessions = db.data.sessions.filter(
      (s) => s.runId !== runId || s.status !== "planned",
    );
    await db.write();
  }

  async listSessionsByRun(runId: string): Promise<WorkoutSession[]> {
    const db = await getDb();
    return db.data.sessions
      .filter((s) => s.runId === runId)
      .sort((a, b) => a.date.localeCompare(b.date));
  }
  async listSessionsByUser(
    userId: string,
    fromDate: string,
    toDate: string,
  ): Promise<WorkoutSession[]> {
    const db = await getDb();
    return db.data.sessions
      .filter(
        (s) => s.userId === userId && s.date >= fromDate && s.date <= toDate,
      )
      .sort((a, b) => a.date.localeCompare(b.date));
  }
  async getSession(id: string): Promise<WorkoutSession | null> {
    return (await getDb()).data.sessions.find((s) => s.id === id) ?? null;
  }
  async updateSession(session: WorkoutSession): Promise<WorkoutSession> {
    const db = await getDb();
    upsert(db.data.sessions, session);
    await db.write();
    return session;
  }

  async listCompletedSessions(
    userId: string,
    limit = 200,
  ): Promise<WorkoutSession[]> {
    const db = await getDb();
    return db.data.sessions
      .filter((s) => s.userId === userId && s.status === "completed")
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, limit);
  }

  async listExerciseNotes(userId: string): Promise<ExerciseNote[]> {
    return (await getDb()).data.exerciseNotes.filter(
      (n) => n.userId === userId,
    );
  }
  async saveExerciseNote(note: ExerciseNote): Promise<ExerciseNote> {
    const db = await getDb();
    const i = db.data.exerciseNotes.findIndex(
      (n) =>
        n.userId === note.userId &&
        n.exerciseId === note.exerciseId &&
        n.techniqueId === note.techniqueId,
    );
    if (i === -1) db.data.exerciseNotes.push(note);
    else db.data.exerciseNotes[i] = note;
    await db.write();
    return note;
  }

  // Users -----------------------------------------------------------------
  async getProfile(userId: string): Promise<Profile | null> {
    return (await getDb()).data.profiles.find((p) => p.id === userId) ?? null;
  }
}
