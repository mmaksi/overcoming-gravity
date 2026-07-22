import { mkdirSync } from "node:fs";
import path from "node:path";
import { JSONFilePreset } from "lowdb/node";
import { Low } from "lowdb";
import {
  BodyweightEntry,
  CustomWorkout,
  DefaultTemplate,
  Exercise,
  ExerciseNote,
  ExerciseNoteKey,
  Feedback,
  planFromStatus,
  Profile,
  ProfileStats,
  Program,
  ProgramDayPlan,
  ProgramRun,
  ProgramSummary,
  SessionSummary,
  SportDef,
  SubscriptionSnapshot,
  Voucher,
  WorkoutSession,
} from "@/lib/domain/schemas";
import { Weekday } from "@/lib/domain/types";
import { DataStore } from "./store";
import { DbData, seedData } from "./seed";

// Projections to the lightweight summary shapes (see schemas.ts). The JSON
// store already holds everything in memory, so these just drop heavy fields to
// keep the shape identical to what SupabaseStore returns from narrow selects.
function toProgramSummary({ mesocycle: _m, ...rest }: Program): ProgramSummary {
  void _m;
  return rest;
}
function toSessionSummary({
  entries,
  ...rest
}: WorkoutSession): SessionSummary {
  return { ...rest, hasEntries: entries.length > 0 };
}

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
        normalizeLegacy(db.data);
        await db.write(); // materialize the seed on first run
        return db;
      },
    );
    return globalCache.__caliJsonDb;
  }
  const db = await globalCache.__caliJsonDb;
  await db.read();
  normalizeLegacy(db.data);
  return db;
}

/** Patch databases written by older app versions in place. */
function normalizeLegacy(data: DbData): void {
  data.exerciseNotes ??= [];
  data.customWorkouts ??= [];
  data.bodyweightEntries ??= [];
  data.feedback ??= [];
  data.vouchers ??= [];
  data.sports ??= [];
  // Billing shipped after the first profiles existed.
  for (const profile of data.profiles) {
    profile.plan ??= "free";
    profile.planCancelAtPeriodEnd ??= false;
    profile.hadSubscription ??= false;
  }
  // "cardio" was removed as an attribute; conditioning belongs to warm-up.
  for (const exercise of data.exercises) {
    if ((exercise.attribute as string) === "cardio") {
      exercise.attribute = "warmup";
    }
  }
  // The template used to be a flat entries list; it is now a workout day.
  const template = data.defaultTemplate as unknown as {
    day?: DbData["defaultTemplate"]["day"];
    entries?: {
      exerciseId: string;
      progressionId: string;
      sets: { reps: number }[];
      restSeconds: number;
    }[];
  };
  if (!template.day) {
    template.day = {
      exercises: (template.entries ?? []).map((entry, i) => ({
        id: `default-${entry.exerciseId}-${i}`,
        exerciseId: entry.exerciseId,
        progressionId: entry.progressionId,
        sets: entry.sets,
        restSeconds: entry.restSeconds,
        progressionMethod: "intra" as const,
      })),
      groups: [],
    };
    delete template.entries;
  }
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

  async listSports(): Promise<SportDef[]> {
    return (await getDb()).data.sports;
  }
  async createSport(sport: SportDef): Promise<SportDef> {
    const db = await getDb();
    db.data.sports.push(sport);
    await db.write();
    return sport;
  }
  async deleteSport(id: string): Promise<void> {
    const db = await getDb();
    db.data.sports = db.data.sports.filter((s) => s.id !== id);
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
      (s) => s.runId === undefined || !runIds.includes(s.runId),
    );
    db.data.runs = db.data.runs.filter((r) => r.programId !== id);
    db.data.programs = db.data.programs.filter((p) => p.id !== id);
    await db.write();
  }

  async listProgramSummaries(userId: string): Promise<ProgramSummary[]> {
    const db = await getDb();
    return db.data.programs
      .filter((p) => p.userId === userId)
      .map(toProgramSummary);
  }
  async getProgramSummary(id: string): Promise<ProgramSummary | null> {
    const program = (await getDb()).data.programs.find((p) => p.id === id);
    return program ? toProgramSummary(program) : null;
  }
  async getProgramDay(
    programId: string,
    weekIndex: number,
    weekday: Weekday,
  ): Promise<ProgramDayPlan | null> {
    const program = (await getDb()).data.programs.find(
      (p) => p.id === programId,
    );
    const week = program?.mesocycle.weeks[weekIndex];
    const day = week?.days[weekday];
    if (!week || !day) return null;
    return { day, isDeload: week.isDeload, focus: week.focus };
  }

  // Standalone workouts ------------------------------------------------------
  async listCustomWorkouts(userId: string): Promise<CustomWorkout[]> {
    return (await getDb()).data.customWorkouts.filter(
      (w) => w.userId === userId,
    );
  }
  async getCustomWorkout(id: string): Promise<CustomWorkout | null> {
    return (
      (await getDb()).data.customWorkouts.find((w) => w.id === id) ?? null
    );
  }
  async createCustomWorkout(workout: CustomWorkout): Promise<CustomWorkout> {
    const db = await getDb();
    db.data.customWorkouts.push(workout);
    await db.write();
    return workout;
  }
  async updateCustomWorkout(workout: CustomWorkout): Promise<CustomWorkout> {
    const db = await getDb();
    upsert(db.data.customWorkouts, workout);
    await db.write();
    return workout;
  }
  async deleteCustomWorkout(id: string): Promise<void> {
    const db = await getDb();
    db.data.sessions = db.data.sessions.filter(
      (s) => s.customWorkoutId !== id || s.status !== "planned",
    );
    db.data.customWorkouts = db.data.customWorkouts.filter(
      (w) => w.id !== id,
    );
    await db.write();
  }
  async createSession(session: WorkoutSession): Promise<WorkoutSession> {
    const db = await getDb();
    db.data.sessions.push(session);
    await db.write();
    return session;
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
  async listSessionSummariesByRun(runId: string): Promise<SessionSummary[]> {
    return (await this.listSessionsByRun(runId)).map(toSessionSummary);
  }
  async listSessionSummariesByUser(
    userId: string,
    fromDate: string,
    toDate: string,
  ): Promise<SessionSummary[]> {
    const db = await getDb();
    return db.data.sessions
      .filter(
        (s) => s.userId === userId && s.date >= fromDate && s.date <= toDate,
      )
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(toSessionSummary);
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
  async deleteSession(id: string): Promise<void> {
    const db = await getDb();
    db.data.sessions = db.data.sessions.filter((s) => s.id !== id);
    await db.write();
  }

  async listCompletedSessions(
    userId: string,
    limit = 200,
    offset = 0,
  ): Promise<WorkoutSession[]> {
    const db = await getDb();
    return db.data.sessions
      .filter((s) => s.userId === userId && s.status === "completed")
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(offset, offset + limit);
  }

  async listCompletedSessionsByExercises(
    userId: string,
    exerciseIds: string[],
  ): Promise<WorkoutSession[]> {
    if (exerciseIds.length === 0) return [];
    const wanted = new Set(exerciseIds);
    const db = await getDb();
    return db.data.sessions
      .filter(
        (s) =>
          s.userId === userId &&
          s.status === "completed" &&
          s.entries.some((e) => wanted.has(e.exerciseId)),
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  async listFinishedSessions(userId: string): Promise<SessionSummary[]> {
    const db = await getDb();
    return db.data.sessions
      .filter(
        (s) =>
          s.userId === userId &&
          (s.status === "completed" || s.status === "skipped"),
      )
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(toSessionSummary);
  }

  async listExerciseNotes(
    userId: string,
    exerciseIds?: string[],
  ): Promise<ExerciseNote[]> {
    const wanted = exerciseIds ? new Set(exerciseIds) : null;
    return (await getDb()).data.exerciseNotes.filter(
      (n) => n.userId === userId && (!wanted || wanted.has(n.exerciseId)),
    );
  }
  async saveExerciseNotes(notes: ExerciseNote[]): Promise<void> {
    if (notes.length === 0) return;
    const db = await getDb();
    for (const note of notes) {
      const i = db.data.exerciseNotes.findIndex(
        (n) =>
          n.userId === note.userId &&
          n.exerciseId === note.exerciseId &&
          n.progressionId === note.progressionId,
      );
      if (i === -1) db.data.exerciseNotes.push(note);
      else db.data.exerciseNotes[i] = note;
    }
    await db.write();
  }
  async deleteExerciseNotes(keys: ExerciseNoteKey[]): Promise<void> {
    if (keys.length === 0) return;
    const db = await getDb();
    const drop = new Set(
      keys.map((k) => `${k.userId}:${k.exerciseId}:${k.progressionId}`),
    );
    const before = db.data.exerciseNotes.length;
    db.data.exerciseNotes = db.data.exerciseNotes.filter(
      (n) => !drop.has(`${n.userId}:${n.exerciseId}:${n.progressionId}`),
    );
    if (db.data.exerciseNotes.length !== before) await db.write();
  }

  // Users -----------------------------------------------------------------
  async getProfile(userId: string): Promise<Profile | null> {
    return (await getDb()).data.profiles.find((p) => p.id === userId) ?? null;
  }
  async updateProfileName(userId: string, name: string): Promise<void> {
    const db = await getDb();
    const profile = db.data.profiles.find((p) => p.id === userId);
    if (!profile) return;
    profile.name = name;
    await db.write();
  }
  async updateProfileAvatar(
    userId: string,
    avatarUrl: string | null,
  ): Promise<void> {
    const db = await getDb();
    const profile = db.data.profiles.find((p) => p.id === userId);
    if (!profile) return;
    profile.avatarUrl = avatarUrl ?? undefined;
    await db.write();
  }
  async updateProfileStats(
    userId: string,
    stats: ProfileStats,
  ): Promise<void> {
    const db = await getDb();
    const profile = db.data.profiles.find((p) => p.id === userId);
    if (!profile) return;
    profile.heightCm = stats.heightCm ?? undefined;
    profile.targetWeightKg = stats.targetWeightKg ?? undefined;
    await db.write();
  }
  async updateProfileWelcome(
    userId: string,
    showWelcome: boolean,
  ): Promise<void> {
    const db = await getDb();
    const profile = db.data.profiles.find((p) => p.id === userId);
    if (!profile) return;
    profile.showWelcome = showWelcome;
    await db.write();
  }
  async updateProfileDesignerIntro(
    userId: string,
    show: boolean,
  ): Promise<void> {
    const db = await getDb();
    const profile = db.data.profiles.find((p) => p.id === userId);
    if (!profile) return;
    profile.showDesignerIntro = show;
    await db.write();
  }
  async setProfileSignupSource(userId: string, source: string): Promise<void> {
    const db = await getDb();
    const profile = db.data.profiles.find((p) => p.id === userId);
    // Write-once: the first sign-in attributes the account.
    if (!profile || profile.signupSource) return;
    profile.signupSource = source;
    await db.write();
  }

  // Billing -----------------------------------------------------------------
  async setProfileBillingCustomer(
    userId: string,
    provider: string,
    customerId: string,
  ): Promise<void> {
    const db = await getDb();
    const profile = db.data.profiles.find((p) => p.id === userId);
    if (!profile) return;
    profile.billingProvider = provider;
    profile.billingCustomerId = customerId;
    await db.write();
  }
  async applySubscription(
    provider: string,
    customerId: string,
    subscription: SubscriptionSnapshot | null,
  ): Promise<void> {
    const db = await getDb();
    const profile = db.data.profiles.find(
      (p) =>
        p.billingProvider === provider && p.billingCustomerId === customerId,
    );
    if (!profile) return;
    profile.plan = planFromStatus(subscription?.status);
    profile.planInterval = subscription?.interval;
    profile.planRenewsAt = subscription?.periodEnd;
    profile.planCancelAtPeriodEnd = subscription?.cancelAtPeriodEnd ?? false;
    // Sticky: once subscribed, always "had a subscription" (kills the trial
    // promise in paywall copy for lapsed users).
    if (subscription) profile.hadSubscription = true;
    await db.write();
  }

  // Vouchers ----------------------------------------------------------------
  async listVouchers(): Promise<Voucher[]> {
    const db = await getDb();
    return [...db.data.vouchers].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }
  async getVoucherByCode(code: string): Promise<Voucher | null> {
    const db = await getDb();
    const needle = code.trim().toUpperCase();
    return db.data.vouchers.find((v) => v.code === needle) ?? null;
  }
  async createVoucher(voucher: Voucher): Promise<Voucher> {
    const db = await getDb();
    if (db.data.vouchers.some((v) => v.code === voucher.code)) {
      throw new Error("A voucher with this code already exists");
    }
    db.data.vouchers.push(voucher);
    await db.write();
    return voucher;
  }
  async deleteVoucher(id: string): Promise<void> {
    const db = await getDb();
    db.data.vouchers = db.data.vouchers.filter((v) => v.id !== id);
    await db.write();
  }
  async incrementVoucherRedemptions(id: string): Promise<void> {
    const db = await getDb();
    const voucher = db.data.vouchers.find((v) => v.id === id);
    if (!voucher) return;
    voucher.redemptions += 1;
    await db.write();
  }

  // Bodyweight tracking ---------------------------------------------------
  async listBodyweightEntries(userId: string): Promise<BodyweightEntry[]> {
    const db = await getDb();
    return db.data.bodyweightEntries
      .filter((e) => e.userId === userId)
      .sort((a, b) => a.date.localeCompare(b.date));
  }
  async saveBodyweightEntry(entry: BodyweightEntry): Promise<BodyweightEntry> {
    const db = await getDb();
    const i = db.data.bodyweightEntries.findIndex(
      (e) => e.userId === entry.userId && e.date === entry.date,
    );
    if (i === -1) db.data.bodyweightEntries.push(entry);
    else db.data.bodyweightEntries[i] = entry;
    await db.write();
    return entry;
  }
  async deleteBodyweightEntry(id: string): Promise<void> {
    const db = await getDb();
    db.data.bodyweightEntries = db.data.bodyweightEntries.filter(
      (e) => e.id !== id,
    );
    await db.write();
  }

  // Feedback --------------------------------------------------------------
  async createFeedback(feedback: Feedback): Promise<Feedback> {
    const db = await getDb();
    db.data.feedback.push(feedback);
    await db.write();
    return feedback;
  }

  async listFeedback(): Promise<Feedback[]> {
    const db = await getDb();
    return [...db.data.feedback].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }
}
