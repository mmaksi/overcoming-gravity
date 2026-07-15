import {
  BodyweightEntry,
  CustomWorkout,
  DefaultTemplate,
  Exercise,
  ExerciseNote,
  Feedback,
  Profile,
  ProfileStats,
  Program,
  ProgramRun,
  ProgramSummary,
  SessionSummary,
  WorkoutDay,
  WorkoutSession,
} from "@/lib/domain/schemas";
import { Weekday } from "@/lib/domain/types";

/**
 * The single seam between the app and its persistence. Two implementations:
 * JsonStore (local development, data/db.json) and SupabaseStore (production).
 * UI code and server actions must only ever talk to this interface.
 */
export interface DataStore {
  // Admin-managed content ---------------------------------------------------
  listExercises(): Promise<Exercise[]>;
  getExercise(id: string): Promise<Exercise | null>;
  createExercise(exercise: Exercise): Promise<Exercise>;
  updateExercise(exercise: Exercise): Promise<Exercise>;
  deleteExercise(id: string): Promise<void>;

  getDefaultTemplate(): Promise<DefaultTemplate>;
  saveDefaultTemplate(template: DefaultTemplate): Promise<DefaultTemplate>;

  // User content --------------------------------------------------------------
  listPrograms(userId: string): Promise<Program[]>;
  getProgram(id: string): Promise<Program | null>;
  createProgram(program: Program): Promise<Program>;
  updateProgram(program: Program): Promise<Program>;
  deleteProgram(id: string): Promise<void>;

  /**
   * Summary reads that omit the (large) embedded mesocycle — for the program
   * list, dashboard cards and calendar, which never render the full plan.
   */
  listProgramSummaries(userId: string): Promise<ProgramSummary[]>;
  getProgramSummary(id: string): Promise<ProgramSummary | null>;
  /** A single planned day out of a program's mesocycle (dashboard "up next"). */
  getProgramDay(
    programId: string,
    weekIndex: number,
    weekday: Weekday,
  ): Promise<WorkoutDay | null>;

  // Standalone workouts outside any program.
  listCustomWorkouts(userId: string): Promise<CustomWorkout[]>;
  getCustomWorkout(id: string): Promise<CustomWorkout | null>;
  createCustomWorkout(workout: CustomWorkout): Promise<CustomWorkout>;
  updateCustomWorkout(workout: CustomWorkout): Promise<CustomWorkout>;
  /** Also removes the workout's not-yet-done sessions. */
  deleteCustomWorkout(id: string): Promise<void>;
  createSession(session: WorkoutSession): Promise<WorkoutSession>;

  listRuns(userId: string): Promise<ProgramRun[]>;
  getRun(id: string): Promise<ProgramRun | null>;
  createRun(
    run: ProgramRun,
    sessions: Omit<WorkoutSession, "id">[],
  ): Promise<ProgramRun>;
  updateRun(run: ProgramRun): Promise<ProgramRun>;

  listSessionsByRun(runId: string): Promise<WorkoutSession[]>;
  /** Session summaries (no performed-set entries) for a run — dashboard cards. */
  listSessionSummariesByRun(runId: string): Promise<SessionSummary[]>;
  /** Remove a run's not-yet-done sessions (used when a run is abandoned). */
  deletePlannedSessions(runId: string): Promise<void>;
  listSessionsByUser(
    userId: string,
    fromDate: string,
    toDate: string,
  ): Promise<WorkoutSession[]>;
  /** Session summaries (no entries) in a date window — the calendar grid. */
  listSessionSummariesByUser(
    userId: string,
    fromDate: string,
    toDate: string,
  ): Promise<SessionSummary[]>;
  getSession(id: string): Promise<WorkoutSession | null>;
  updateSession(session: WorkoutSession): Promise<WorkoutSession>;
  /** Permanently remove a session (used to delete a workout from history). */
  deleteSession(id: string): Promise<void>;

  /**
   * Completed workouts, newest first. Powers history, the progress overview
   * and intra-exercise progression memory (see domain/volume.ts). `offset`
   * pages through older workouts (history infinite scroll).
   */
  listCompletedSessions(
    userId: string,
    limit?: number,
    offset?: number,
  ): Promise<WorkoutSession[]>;

  /**
   * Completed workouts (newest first) that include any of `exerciseIds` — the
   * workout logger only needs progression stats for the planned exercises, so
   * this avoids downloading a user's entire completed history. An empty
   * `exerciseIds` returns nothing.
   */
  listCompletedSessionsByExercises(
    userId: string,
    exerciseIds: string[],
  ): Promise<WorkoutSession[]>;

  /**
   * Every finished schedule slot — completed **and** skipped — oldest first.
   * Powers the workout streak (consecutive completions, broken by a skip).
   */
  listFinishedSessions(userId: string): Promise<WorkoutSession[]>;

  /**
   * A user's remembered notes per exercise progression. Saving upserts on
   * (userId, exerciseId, progressionId).
   */
  listExerciseNotes(userId: string): Promise<ExerciseNote[]>;
  saveExerciseNote(note: ExerciseNote): Promise<ExerciseNote>;

  // Users -----------------------------------------------------------------
  getProfile(userId: string): Promise<Profile | null>;
  updateProfileName(userId: string, name: string): Promise<void>;
  updateProfileAvatar(userId: string, avatarUrl: string | null): Promise<void>;
  /** Body stats for BMI (height, target weight); null clears a value. */
  updateProfileStats(userId: string, stats: ProfileStats): Promise<void>;

  // Bodyweight tracking ---------------------------------------------------
  listBodyweightEntries(userId: string): Promise<BodyweightEntry[]>;
  /** Upsert on (userId, date): one weigh-in per day, latest wins. */
  saveBodyweightEntry(entry: BodyweightEntry): Promise<BodyweightEntry>;
  deleteBodyweightEntry(id: string): Promise<void>;

  // Feedback --------------------------------------------------------------
  createFeedback(feedback: Feedback): Promise<Feedback>;
  /** All feedback, newest first — the admin inbox. */
  listFeedback(): Promise<Feedback[]>;
}
