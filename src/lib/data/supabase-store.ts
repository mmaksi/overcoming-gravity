import "server-only";
import { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  BodyweightEntry,
  CustomWorkout,
  DefaultTemplate,
  Exercise,
  ExerciseNote,
  Feedback,
  isTimeMeasurement,
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

/**
 * The `exercises.measurement` column carries a `check (in ('reps','time'))`
 * constraint, so the precise seconds/minutes unit lives per-progression in the
 * `progressions` jsonb instead. Collapse the exercise-level default to a value
 * the column accepts on write.
 */
const columnMeasurement = (m: string): "reps" | "time" =>
  m === "time" || isTimeMeasurement(m as Exercise["measurement"])
    ? "time"
    : "reps";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;
type Tables = Database["public"]["Tables"];

// Row ↔ domain mappers (tables use snake_case; jsonb columns hold documents).

const toVoucher = (r: Row): Voucher => ({
  id: r.id,
  code: r.code,
  percentOff: r.percent_off,
  validFrom: r.valid_from ?? undefined,
  validUntil: r.valid_until ?? undefined,
  maxRedemptions: r.max_redemptions ?? undefined,
  redemptions: r.redemptions,
  createdAt: r.created_at,
});

const toExercise = (r: Row): Exercise => ({
  id: r.id,
  title: r.title,
  category: r.category,
  // "cardio" was removed as an attribute; treat legacy rows as warm-up.
  attribute: r.attribute === "cardio" ? "warmup" : r.attribute,
  measurement: r.measurement ?? "reps",
  repStyle: r.rep_style ?? "standard",
  sport: r.sport ?? undefined,
  imageUrl: r.image_url ?? undefined,
  progressions: r.progressions,
});

// Explicit column lists (finding 7): reads name exactly what they need so a new
// column never silently inflates an existing screen's payload, and summary
// reads can drop the big jsonb documents (mesocycle / entries / day).
const PROGRAM_SUMMARY_COLS =
  "id,user_id,name,type,split_type,sport,goals,periodization,weeks,training_days,status,created_at,updated_at";
const PROGRAM_COLS = `${PROGRAM_SUMMARY_COLS},mesocycle`;
const SESSION_SUMMARY_COLS =
  "id,run_id,custom_workout_id,user_id,date,week_index,weekday,status,has_entries,duration_seconds";
const SESSION_COLS =
  "id,run_id,custom_workout_id,user_id,date,week_index,weekday,status,entries,duration_seconds";
const CUSTOM_WORKOUT_SUMMARY_COLS = "id,user_id,title,created_at,updated_at";
const CUSTOM_WORKOUT_COLS = `${CUSTOM_WORKOUT_SUMMARY_COLS},day`;

const toProgram = (r: Row): Program => ({
  id: r.id,
  userId: r.user_id,
  name: r.name,
  type: r.type,
  splitType: r.split_type ?? undefined,
  sport: r.sport ?? undefined,
  goals: r.goals ?? undefined,
  periodization: r.periodization,
  weeks: r.weeks,
  trainingDays: r.training_days,
  mesocycle: r.mesocycle,
  status: r.status,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toProgramSummary = (r: Row): ProgramSummary => ({
  id: r.id,
  userId: r.user_id,
  name: r.name,
  type: r.type,
  splitType: r.split_type ?? undefined,
  sport: r.sport ?? undefined,
  goals: r.goals ?? undefined,
  periodization: r.periodization,
  weeks: r.weeks,
  trainingDays: r.training_days,
  status: r.status,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const fromProgram = (p: Program): Tables["programs"]["Insert"] => ({
  id: p.id,
  user_id: p.userId,
  name: p.name,
  type: p.type,
  split_type: p.splitType ?? null,
  sport: p.sport ?? null,
  goals: p.goals ?? null,
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

const fromRun = (r: ProgramRun): Tables["runs"]["Insert"] => ({
  id: r.id,
  program_id: r.programId,
  user_id: r.userId,
  start_date: r.startDate,
  status: r.status,
  created_at: r.createdAt,
});

const toSession = (r: Row): WorkoutSession => ({
  id: r.id,
  runId: r.run_id ?? undefined,
  customWorkoutId: r.custom_workout_id ?? undefined,
  userId: r.user_id,
  date: r.date,
  weekIndex: r.week_index,
  weekday: r.weekday,
  status: r.status,
  entries: r.entries,
  durationSeconds: r.duration_seconds ?? undefined,
});

const toSessionSummary = (r: Row): SessionSummary => ({
  id: r.id,
  runId: r.run_id ?? undefined,
  customWorkoutId: r.custom_workout_id ?? undefined,
  userId: r.user_id,
  date: r.date,
  weekIndex: r.week_index,
  weekday: r.weekday,
  status: r.status,
  durationSeconds: r.duration_seconds ?? undefined,
  // `has_entries` is a generated column (migration 0010) so summaries never
  // download the `entries` document just to know whether any sets were logged.
  hasEntries: r.has_entries ?? false,
});

const fromSession = (s: WorkoutSession): Tables["sessions"]["Insert"] => ({
  id: s.id,
  run_id: s.runId ?? null,
  custom_workout_id: s.customWorkoutId ?? null,
  user_id: s.userId,
  date: s.date,
  week_index: s.weekIndex,
  weekday: s.weekday,
  status: s.status,
  entries: s.entries,
  duration_seconds: s.durationSeconds ?? null,
});

const toCustomWorkout = (r: Row): CustomWorkout => ({
  id: r.id,
  userId: r.user_id,
  title: r.title,
  day: r.day,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const fromCustomWorkout = (w: CustomWorkout): Tables["custom_workouts"]["Insert"] => ({
  id: w.id,
  user_id: w.userId,
  title: w.title,
  day: w.day,
  created_at: w.createdAt,
  updated_at: w.updatedAt,
});

function orThrow<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

class SupabaseStore implements DataStore {
  constructor(private db: SupabaseClient<Database>) {}

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
        measurement: columnMeasurement(exercise.measurement),
        rep_style: exercise.repStyle,
        sport: exercise.sport || null,
        image_url: exercise.imageUrl || null,
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
          measurement: columnMeasurement(exercise.measurement),
          rep_style: exercise.repStyle,
          sport: exercise.sport || null,
          image_url: exercise.imageUrl || null,
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

  async listSports(): Promise<SportDef[]> {
    return orThrow(await this.db.from("sports").select().order("name"));
  }
  async createSport(sport: SportDef): Promise<SportDef> {
    orThrow(await this.db.from("sports").insert(sport).select());
    return sport;
  }
  async deleteSport(id: string): Promise<void> {
    orThrow(await this.db.from("sports").delete().eq("id", id).select());
  }

  async getDefaultTemplate(): Promise<DefaultTemplate> {
    const rows = orThrow(
      await this.db.from("default_template").select().eq("id", "default"),
    );
    if (rows.length === 0) {
      return { id: "default", day: { exercises: [], groups: [] } };
    }
    if (rows[0].day)
      return { id: "default", day: rows[0].day as DefaultTemplate["day"] };
    // Legacy shape: a flat entries list, converted on read (0006 backfills).
    const entries = (rows[0].entries ?? []) as Row[];
    return {
      id: "default",
      day: {
        exercises: entries.map((entry, i) => ({
          id: `default-${entry.exerciseId}-${i}`,
          exerciseId: entry.exerciseId,
          progressionId: entry.progressionId,
          sets: entry.sets,
          restSeconds: entry.restSeconds,
          progressionMethod: "intra" as const,
        })),
        groups: [],
      },
    };
  }
  async saveDefaultTemplate(template: DefaultTemplate): Promise<DefaultTemplate> {
    orThrow(
      await this.db
        .from("default_template")
        .upsert({ id: "default", day: template.day })
        .select(),
    );
    return template;
  }


  // User content --------------------------------------------------------------
  async getProgram(id: string): Promise<Program | null> {
    const rows = orThrow(
      await this.db.from("programs").select(PROGRAM_COLS).eq("id", id),
    );
    return rows.length > 0 ? toProgram(rows[0]) : null;
  }
  async listProgramSummaries(userId: string): Promise<ProgramSummary[]> {
    return orThrow(
      await this.db
        .from("programs")
        .select(PROGRAM_SUMMARY_COLS)
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
    ).map(toProgramSummary);
  }
  async getProgramSummary(id: string): Promise<ProgramSummary | null> {
    const rows = orThrow(
      await this.db.from("programs").select(PROGRAM_SUMMARY_COLS).eq("id", id),
    );
    return rows.length > 0 ? toProgramSummary(rows[0]) : null;
  }
  async getProgramDay(
    programId: string,
    weekIndex: number,
    weekday: Weekday,
  ): Promise<ProgramDayPlan | null> {
    // jsonb path selection: Postgres extracts the one planned day and its
    // week's context, so the (large) mesocycle document never leaves the
    // database. `weekIndex` is a validated integer and `weekday` an enum, so
    // interpolating them into the select list is safe.
    const week = `mesocycle->weeks->${weekIndex}`;
    const rows = orThrow(
      await this.db
        .from("programs")
        .select(
          `day:${week}->days->${weekday},is_deload:${week}->isDeload,focus:${week}->focus`,
        )
        .eq("id", programId),
    );
    const row = rows[0] as Row | undefined;
    if (!row?.day) return null;
    return {
      day: row.day,
      isDeload: row.is_deload === true,
      focus: row.focus ?? undefined,
    };
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

  // Standalone workouts ------------------------------------------------------
  async listCustomWorkouts(userId: string): Promise<CustomWorkout[]> {
    return orThrow(
      await this.db
        .from("custom_workouts")
        .select(CUSTOM_WORKOUT_COLS)
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
    ).map(toCustomWorkout);
  }
  async getCustomWorkout(id: string): Promise<CustomWorkout | null> {
    const rows = orThrow(
      await this.db.from("custom_workouts").select(CUSTOM_WORKOUT_COLS).eq("id", id),
    );
    return rows.length > 0 ? toCustomWorkout(rows[0]) : null;
  }
  async createCustomWorkout(workout: CustomWorkout): Promise<CustomWorkout> {
    orThrow(
      await this.db
        .from("custom_workouts")
        .insert(fromCustomWorkout(workout))
        .select(),
    );
    return workout;
  }
  async updateCustomWorkout(workout: CustomWorkout): Promise<CustomWorkout> {
    orThrow(
      await this.db
        .from("custom_workouts")
        .update(fromCustomWorkout(workout))
        .eq("id", workout.id)
        .select(),
    );
    return workout;
  }
  async deleteCustomWorkout(id: string): Promise<void> {
    orThrow(
      await this.db
        .from("sessions")
        .delete()
        .eq("custom_workout_id", id)
        .eq("status", "planned")
        .select("id"),
    );
    orThrow(
      await this.db.from("custom_workouts").delete().eq("id", id).select(),
    );
  }
  async createSession(session: WorkoutSession): Promise<WorkoutSession> {
    orThrow(
      await this.db.from("sessions").insert(fromSession(session)).select("id"),
    );
    return session;
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
      await this.db
        .from("sessions")
        .select(SESSION_COLS)
        .eq("run_id", runId)
        .order("date"),
    ).map(toSession);
  }
  async listSessionSummariesByRun(runId: string): Promise<SessionSummary[]> {
    return orThrow(
      await this.db
        .from("sessions")
        .select(SESSION_SUMMARY_COLS)
        .eq("run_id", runId)
        .order("date"),
    ).map(toSessionSummary);
  }
  async listSessionSummariesByUser(
    userId: string,
    fromDate: string,
    toDate: string,
  ): Promise<SessionSummary[]> {
    return orThrow(
      await this.db
        .from("sessions")
        .select(SESSION_SUMMARY_COLS)
        .eq("user_id", userId)
        .gte("date", fromDate)
        .lte("date", toDate)
        .order("date"),
    ).map(toSessionSummary);
  }
  async getSession(id: string): Promise<WorkoutSession | null> {
    const rows = orThrow(
      await this.db.from("sessions").select(SESSION_COLS).eq("id", id),
    );
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
  async deleteSession(id: string): Promise<void> {
    orThrow(
      await this.db.from("sessions").delete().eq("id", id).select("id"),
    );
  }

  async listCompletedSessions(
    userId: string,
    limit = 200,
    offset = 0,
  ): Promise<WorkoutSession[]> {
    return orThrow(
      await this.db
        .from("sessions")
        .select(SESSION_COLS)
        .eq("user_id", userId)
        .eq("status", "completed")
        .order("date", { ascending: false })
        .range(offset, offset + limit - 1),
    ).map(toSession);
  }

  async listCompletedSessionsByExercises(
    userId: string,
    exerciseIds: string[],
  ): Promise<WorkoutSession[]> {
    if (exerciseIds.length === 0) return [];
    // A DB function filters to sessions whose entries reference any planned
    // exercise (migration 0010), so the logger never downloads the user's
    // whole completed history just to build stats for a handful of exercises.
    const { data, error } = await this.db.rpc(
      "completed_sessions_for_exercises",
      { p_user_id: userId, p_exercise_ids: exerciseIds },
    );
    if (error) throw new Error(error.message);
    return ((data ?? []) as Row[]).map(toSession);
  }

  async listFinishedSessions(userId: string): Promise<SessionSummary[]> {
    // Summaries only: the streak reads statuses, never performed sets.
    return orThrow(
      await this.db
        .from("sessions")
        .select(SESSION_SUMMARY_COLS)
        .eq("user_id", userId)
        .in("status", ["completed", "skipped"])
        .order("date", { ascending: true }),
    ).map(toSessionSummary);
  }

  async listExerciseNotes(
    userId: string,
    exerciseIds?: string[],
  ): Promise<ExerciseNote[]> {
    let query = this.db.from("exercise_notes").select().eq("user_id", userId);
    if (exerciseIds) {
      if (exerciseIds.length === 0) return [];
      query = query.in("exercise_id", exerciseIds);
    }
    return orThrow(await query).map((r: Row) => ({
      userId: r.user_id,
      exerciseId: r.exercise_id,
      // The `technique_id` column now carries the progression id (notes moved
      // from per-exercise to per-progression without a schema migration).
      progressionId: r.technique_id,
      note: r.note,
      updatedAt: r.updated_at,
    }));
  }
  async saveExerciseNotes(notes: ExerciseNote[]): Promise<void> {
    if (notes.length === 0) return;
    // One bulk upsert per save — a workout save used to fire one round trip
    // per entry note (docs/performance-data-transfer-review.md, finding 8).
    orThrow(
      await this.db
        .from("exercise_notes")
        .upsert(
          notes.map((note) => ({
            user_id: note.userId,
            exercise_id: note.exerciseId,
            // Reused column: holds the progression id (see listExerciseNotes).
            technique_id: note.progressionId,
            note: note.note,
            updated_at: note.updatedAt,
          })),
        )
        .select("exercise_id"),
    );
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
      firstName: rows[0].first_name ?? undefined,
      lastName: rows[0].last_name ?? undefined,
      isAdmin: rows[0].is_admin,
      avatarUrl: rows[0].avatar_url ?? undefined,
      heightCm: rows[0].height_cm ?? undefined,
      targetWeightKg: rows[0].target_weight_kg ?? undefined,
      showWelcome: rows[0].show_welcome ?? true,
      showDesignerIntro: rows[0].show_designer_intro ?? true,
      plan: planFromStatus(rows[0].subscription_status),
      planInterval:
        rows[0].subscription_interval === "month" ||
        rows[0].subscription_interval === "year"
          ? rows[0].subscription_interval
          : undefined,
      planRenewsAt: rows[0].subscription_period_end ?? undefined,
      planCancelAtPeriodEnd: rows[0].subscription_cancel_at_period_end ?? false,
      billingProvider: rows[0].billing_provider ?? undefined,
      billingCustomerId: rows[0].billing_customer_id ?? undefined,
      hadSubscription:
        rows[0].billing_subscription_id != null ||
        rows[0].subscription_status != null,
      signupSource: rows[0].signup_source ?? undefined,
    };
  }
  async updateProfileName(userId: string, name: string): Promise<void> {
    orThrow(
      await this.db
        .from("profiles")
        .update({ name })
        .eq("id", userId)
        .select("id"),
    );
  }
  async updateProfileAvatar(
    userId: string,
    avatarUrl: string | null,
  ): Promise<void> {
    orThrow(
      await this.db
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("id", userId)
        .select("id"),
    );
  }
  async updateProfileStats(userId: string, stats: ProfileStats): Promise<void> {
    orThrow(
      await this.db
        .from("profiles")
        .update({
          height_cm: stats.heightCm,
          target_weight_kg: stats.targetWeightKg,
        })
        .eq("id", userId)
        .select("id"),
    );
  }
  async updateProfileWelcome(
    userId: string,
    showWelcome: boolean,
  ): Promise<void> {
    orThrow(
      await this.db
        .from("profiles")
        .update({ show_welcome: showWelcome })
        .eq("id", userId)
        .select("id"),
    );
  }
  async updateProfileDesignerIntro(
    userId: string,
    show: boolean,
  ): Promise<void> {
    orThrow(
      await this.db
        .from("profiles")
        .update({ show_designer_intro: show })
        .eq("id", userId)
        .select("id"),
    );
  }
  async setProfileSignupSource(userId: string, source: string): Promise<void> {
    // Write-once: the null filter makes a second sign-in a no-op.
    orThrow(
      await this.db
        .from("profiles")
        .update({ signup_source: source })
        .eq("id", userId)
        .is("signup_source", null)
        .select("id"),
    );
  }

  // Billing -----------------------------------------------------------------
  // Only ever called on the service store: a profiles trigger rejects billing
  // writes from user-scoped sessions (see 0013_billing_and_vouchers.sql).
  async setProfileBillingCustomer(
    userId: string,
    provider: string,
    customerId: string,
  ): Promise<void> {
    orThrow(
      await this.db
        .from("profiles")
        .update({
          billing_provider: provider,
          billing_customer_id: customerId,
        })
        .eq("id", userId)
        .select("id"),
    );
  }
  async applySubscription(
    provider: string,
    customerId: string,
    subscription: SubscriptionSnapshot | null,
  ): Promise<void> {
    orThrow(
      await this.db
        .from("profiles")
        .update({
          billing_subscription_id: subscription?.subscriptionId ?? null,
          subscription_status: subscription?.status ?? null,
          subscription_interval: subscription?.interval ?? null,
          subscription_period_end: subscription?.periodEnd ?? null,
          subscription_cancel_at_period_end:
            subscription?.cancelAtPeriodEnd ?? false,
        })
        .eq("billing_provider", provider)
        .eq("billing_customer_id", customerId)
        .select("id"),
    );
  }

  // Vouchers ----------------------------------------------------------------
  async listVouchers(): Promise<Voucher[]> {
    const rows = orThrow(
      await this.db
        .from("vouchers")
        .select()
        .order("created_at", { ascending: false }),
    );
    return rows.map(toVoucher);
  }
  async getVoucherByCode(code: string): Promise<Voucher | null> {
    const rows = orThrow(
      await this.db
        .from("vouchers")
        .select()
        .eq("code", code.trim().toUpperCase()),
    );
    return rows.length > 0 ? toVoucher(rows[0]) : null;
  }
  async createVoucher(voucher: Voucher): Promise<Voucher> {
    orThrow(
      await this.db
        .from("vouchers")
        .insert({
          id: voucher.id,
          code: voucher.code,
          percent_off: voucher.percentOff,
          valid_from: voucher.validFrom ?? null,
          valid_until: voucher.validUntil ?? null,
          max_redemptions: voucher.maxRedemptions ?? null,
          redemptions: voucher.redemptions,
          created_at: voucher.createdAt,
        })
        .select("id"),
    );
    return voucher;
  }
  async deleteVoucher(id: string): Promise<void> {
    orThrow(await this.db.from("vouchers").delete().eq("id", id).select("id"));
  }
  async incrementVoucherRedemptions(id: string): Promise<void> {
    // Two racing redemptions can lose an increment; voucher counts are a
    // cap, not accounting, so that is acceptable.
    const rows = orThrow(
      await this.db.from("vouchers").select("redemptions").eq("id", id),
    );
    if (rows.length === 0) return;
    orThrow(
      await this.db
        .from("vouchers")
        .update({ redemptions: rows[0].redemptions + 1 })
        .eq("id", id)
        .select("id"),
    );
  }

  // Bodyweight tracking ---------------------------------------------------
  async listBodyweightEntries(userId: string): Promise<BodyweightEntry[]> {
    return orThrow(
      await this.db
        .from("bodyweight_entries")
        .select()
        .eq("user_id", userId)
        .order("date", { ascending: true }),
    ).map((r: Row) => ({
      id: r.id,
      userId: r.user_id,
      date: r.date,
      weightKg: r.weight_kg,
      createdAt: r.created_at,
    }));
  }
  async saveBodyweightEntry(entry: BodyweightEntry): Promise<BodyweightEntry> {
    orThrow(
      await this.db
        .from("bodyweight_entries")
        .upsert(
          {
            id: entry.id,
            user_id: entry.userId,
            date: entry.date,
            weight_kg: entry.weightKg,
            created_at: entry.createdAt,
          },
          { onConflict: "user_id,date" },
        )
        .select(),
    );
    return entry;
  }
  async deleteBodyweightEntry(id: string): Promise<void> {
    orThrow(
      await this.db.from("bodyweight_entries").delete().eq("id", id).select(),
    );
  }

  // Feedback --------------------------------------------------------------
  async createFeedback(feedback: Feedback): Promise<Feedback> {
    orThrow(
      await this.db
        .from("feedback")
        .insert({
          id: feedback.id,
          user_id: feedback.userId,
          type: feedback.type,
          message: feedback.message,
          created_at: feedback.createdAt,
        })
        .select(),
    );
    return feedback;
  }

  async listFeedback(): Promise<Feedback[]> {
    return orThrow(
      await this.db
        .from("feedback")
        .select()
        .order("created_at", { ascending: false }),
    ).map((r: Row) => ({
      id: r.id,
      userId: r.user_id,
      type: r.type as Feedback["type"],
      message: r.message,
      createdAt: r.created_at,
    }));
  }
}

/** Per-request store: carries the caller's session cookie so RLS applies. */
export async function createSupabaseStore(): Promise<DataStore> {
  const { createServerSupabase } = await import("@/lib/supabase/server");
  const supabase = await createServerSupabase();
  return new SupabaseStore(supabase);
}

/**
 * Service-role store: bypasses RLS. Only for server-side billing paths
 * (verified provider webhooks, checkout, subscription sync, voucher
 * validation) — never hand it identifiers taken from unverified input.
 */
export async function createServiceSupabaseStore(): Promise<DataStore> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set — required for billing writes",
    );
  }
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return new SupabaseStore(supabase);
}
