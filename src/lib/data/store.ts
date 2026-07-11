import {
  CustomWorkout,
  DefaultTemplate,
  Exercise,
  ExerciseNote,
  Profile,
  Program,
  ProgramRun,
  WorkoutSession,
} from "@/lib/domain/schemas";

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
  /** Remove a run's not-yet-done sessions (used when a run is abandoned). */
  deletePlannedSessions(runId: string): Promise<void>;
  listSessionsByUser(
    userId: string,
    fromDate: string,
    toDate: string,
  ): Promise<WorkoutSession[]>;
  getSession(id: string): Promise<WorkoutSession | null>;
  updateSession(session: WorkoutSession): Promise<WorkoutSession>;

  /**
   * Completed workouts, newest first. Powers history, the progress overview
   * and intra-exercise progression memory (see domain/volume.ts).
   */
  listCompletedSessions(userId: string, limit?: number): Promise<WorkoutSession[]>;

  /**
   * A user's remembered notes per exercise + inter-technique pair. Saving
   * upserts on (userId, exerciseId, techniqueId).
   */
  listExerciseNotes(userId: string): Promise<ExerciseNote[]>;
  saveExerciseNote(note: ExerciseNote): Promise<ExerciseNote>;

  // Users -----------------------------------------------------------------
  getProfile(userId: string): Promise<Profile | null>;
  updateProfileName(userId: string, name: string): Promise<void>;
}
