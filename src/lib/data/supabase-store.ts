import "server-only";
import { SupabaseClient } from "@supabase/supabase-js";
import {
  DefaultTemplate,
  Exercise,
  Profile,
  Program,
  ProgramRun,
  WorkoutSession,
} from "@/lib/domain/schemas";
import { DataStore } from "./store";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

// Row ↔ domain mappers (tables use snake_case; jsonb columns hold documents).

const toExercise = (r: Row): Exercise => ({
  id: r.id,
  title: r.title,
  category: r.category,
  attribute: r.attribute,
  measurement: r.measurement ?? "reps",
  repStyle: r.rep_style ?? "standard",
  progressions: r.progressions,
});

const toProgram = (r: Row): Program => ({
  id: r.id,
  userId: r.user_id,
  name: r.name,
  type: r.type,
  splitType: r.split_type ?? undefined,
  sport: r.sport ?? undefined,
  periodization: r.periodization,
  weeks: r.weeks,
  trainingDays: r.training_days,
  mesocycle: r.mesocycle,
  status: r.status,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const fromProgram = (p: Program): Row => ({
  id: p.id,
  user_id: p.userId,
  name: p.name,
  type: p.type,
  split_type: p.splitType ?? null,
  sport: p.sport ?? null,
  periodization: p.periodization,
  weeks: p.weeks,
  training_days: p.trainingDays,
  mesocycle: p.mesocycle,
  status: p.status,
  created_at: p.createdAt,
  updated_at: p.updatedAt,
});

const toRun = (r: Row): ProgramRun => ({
  id: r.id,
  programId: r.program_id,
  userId: r.user_id,
  startDate: r.start_date,
  status: r.status,
  createdAt: r.created_at,
});

const fromRun = (r: ProgramRun): Row => ({
  id: r.id,
  program_id: r.programId,
  user_id: r.userId,
  start_date: r.startDate,
  status: r.status,
  created_at: r.createdAt,
});

const toSession = (r: Row): WorkoutSession => ({
  id: r.id,
  runId: r.run_id,
  userId: r.user_id,
  date: r.date,
  weekIndex: r.week_index,
  weekday: r.weekday,
  status: r.status,
  entries: r.entries,
});

const fromSession = (s: WorkoutSession): Row => ({
  id: s.id,
  run_id: s.runId,
  user_id: s.userId,
  date: s.date,
  week_index: s.weekIndex,
  weekday: s.weekday,
  status: s.status,
  entries: s.entries,
});

function orThrow<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

class SupabaseStore implements DataStore {
  constructor(private db: SupabaseClient) {}

  // Admin-managed content ---------------------------------------------------
  async listExercises(): Promise<Exercise[]> {
    return orThrow(await this.db.from("exercises").select().order("title")).map(toExercise);
  }
  async getExercise(id: string): Promise<Exercise | null> {
    const rows = orThrow(await this.db.from("exercises").select().eq("id", id));
    return rows.length > 0 ? toExercise(rows[0]) : null;
  }
  async createExercise(exercise: Exercise): Promise<Exercise> {
    orThrow(
      await this.db.from("exercises").insert({
        id: exercise.id,
        title: exercise.title,
        category: exercise.category,
        attribute: exercise.attribute,
        measurement: exercise.measurement,
        rep_style: exercise.repStyle,
        progressions: exercise.progressions,
      }).select(),
    );
    return exercise;
  }
  async updateExercise(exercise: Exercise): Promise<Exercise> {
    orThrow(
      await this.db
        .from("exercises")
        .update({
          title: exercise.title,
          category: exercise.category,
          attribute: exercise.attribute,
          measurement: exercise.measurement,
          rep_style: exercise.repStyle,
          progressions: exercise.progressions,
        })
        .eq("id", exercise.id)
        .select(),
    );
    return exercise;
  }
  async deleteExercise(id: string): Promise<void> {
    orThrow(await this.db.from("exercises").delete().eq("id", id).select());
  }

  async getDefaultTemplate(): Promise<DefaultTemplate> {
    const rows = orThrow(
      await this.db.from("default_template").select().eq("id", "default"),
    );
    return rows.length > 0
      ? { id: "default", entries: rows[0].entries }
      : { id: "default", entries: [] };
  }
  async saveDefaultTemplate(template: DefaultTemplate): Promise<DefaultTemplate> {
    orThrow(
      await this.db
        .from("default_template")
        .upsert({ id: "default", entries: template.entries })
        .select(),
    );
    return template;
  }


  // User content --------------------------------------------------------------
  async listPrograms(userId: string): Promise<Program[]> {
    return orThrow(
      await this.db
        .from("programs")
        .select()
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
    ).map(toProgram);
  }
  async getProgram(id: string): Promise<Program | null> {
    const rows = orThrow(await this.db.from("programs").select().eq("id", id));
    return rows.length > 0 ? toProgram(rows[0]) : null;
  }
  async createProgram(program: Program): Promise<Program> {
    orThrow(await this.db.from("programs").insert(fromProgram(program)).select());
    return program;
  }
  async updateProgram(program: Program): Promise<Program> {
    orThrow(
      await this.db
        .from("programs")
        .update(fromProgram(program))
        .eq("id", program.id)
        .select(),
    );
    return program;
  }
  async deleteProgram(id: string): Promise<void> {
    // runs and sessions cascade via foreign keys
    orThrow(await this.db.from("programs").delete().eq("id", id).select());
  }

  async listRuns(userId: string): Promise<ProgramRun[]> {
    return orThrow(
      await this.db
        .from("runs")
        .select()
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
    ).map(toRun);
  }
  async getRun(id: string): Promise<ProgramRun | null> {
    const rows = orThrow(await this.db.from("runs").select().eq("id", id));
    return rows.length > 0 ? toRun(rows[0]) : null;
  }
  async createRun(
    run: ProgramRun,
    sessions: Omit<WorkoutSession, "id">[],
  ): Promise<ProgramRun> {
    orThrow(await this.db.from("runs").insert(fromRun(run)).select());
    if (sessions.length > 0) {
      orThrow(
        await this.db
          .from("sessions")
          .insert(
            sessions.map((s) =>
              fromSession({ ...s, id: crypto.randomUUID() }),
            ),
          )
          .select("id"),
      );
    }
    return run;
  }
  async updateRun(run: ProgramRun): Promise<ProgramRun> {
    orThrow(
      await this.db.from("runs").update(fromRun(run)).eq("id", run.id).select(),
    );
    return run;
  }

  async deletePlannedSessions(runId: string): Promise<void> {
    orThrow(
      await this.db
        .from("sessions")
        .delete()
        .eq("run_id", runId)
        .eq("status", "planned")
        .select("id"),
    );
  }

  async listSessionsByRun(runId: string): Promise<WorkoutSession[]> {
    return orThrow(
      await this.db.from("sessions").select().eq("run_id", runId).order("date"),
    ).map(toSession);
  }
  async listSessionsByUser(
    userId: string,
    fromDate: string,
    toDate: string,
  ): Promise<WorkoutSession[]> {
    return orThrow(
      await this.db
        .from("sessions")
        .select()
        .eq("user_id", userId)
        .gte("date", fromDate)
        .lte("date", toDate)
        .order("date"),
    ).map(toSession);
  }
  async getSession(id: string): Promise<WorkoutSession | null> {
    const rows = orThrow(await this.db.from("sessions").select().eq("id", id));
    return rows.length > 0 ? toSession(rows[0]) : null;
  }
  async updateSession(session: WorkoutSession): Promise<WorkoutSession> {
    orThrow(
      await this.db
        .from("sessions")
        .update(fromSession(session))
        .eq("id", session.id)
        .select(),
    );
    return session;
  }

  async listCompletedSessions(
    userId: string,
    limit = 200,
  ): Promise<WorkoutSession[]> {
    return orThrow(
      await this.db
        .from("sessions")
        .select()
        .eq("user_id", userId)
        .eq("status", "completed")
        .order("date", { ascending: false })
        .limit(limit),
    ).map(toSession);
  }

  // Users -----------------------------------------------------------------
  async getProfile(userId: string): Promise<Profile | null> {
    const rows = orThrow(
      await this.db.from("profiles").select().eq("id", userId),
    );
    if (rows.length === 0) return null;
    return {
      id: rows[0].id,
      email: rows[0].email ?? undefined,
      name: rows[0].name,
      isAdmin: rows[0].is_admin,
    };
  }
}

/** Per-request store: carries the caller's session cookie so RLS applies. */
export async function createSupabaseStore(): Promise<DataStore> {
  const { createServerSupabase } = await import("@/lib/supabase/server");
  const supabase = await createServerSupabase();
  return new SupabaseStore(supabase);
}
