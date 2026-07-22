"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getStore } from "@/lib/data";
import {
  getCachedCompletedPage,
  getCachedCompletedSessions,
  getCachedExerciseNotes,
  getCachedExercises,
  getCachedUserPrograms,
} from "@/lib/data/cached";
import {
  buildExerciseRecords,
  buildHistoryItems,
  ExerciseRecordGroup,
  HISTORY_PAGE_SIZE,
  HistoryItem,
  makeSessionLabel,
} from "@/lib/domain/history";

const offsetSchema = z.number().int().min(0).max(100_000);

/**
 * One more page of completed workouts for the history infinite scroll.
 * Reads are cached per user (old workouts rarely change); completing or
 * deleting a workout busts them.
 */
export async function loadHistoryPage(
  offset: number,
): Promise<{ items: HistoryItem[]; hasMore: boolean }> {
  const user = await requireUser();
  const parsedOffset = offsetSchema.parse(offset);
  const store = await getStore();

  const [sessions, exercises, { programs, runs, customWorkouts }] =
    await Promise.all([
      getCachedCompletedPage(store, user.id, parsedOffset, HISTORY_PAGE_SIZE),
      getCachedExercises(store),
      getCachedUserPrograms(store, user.id),
    ]);

  const items = buildHistoryItems(
    sessions,
    new Map(exercises.map((e) => [e.id, e])),
    makeSessionLabel(programs, runs, customWorkouts),
  );
  return { items, hasMore: sessions.length === HISTORY_PAGE_SIZE };
}

/**
 * The Progress tab's personal-record groups (and the count on the home
 * records card), fetched only when a client first needs them — this is the
 * heavy full-history read, so it stays out of the calendar's initial render.
 */
export async function loadExerciseRecords(): Promise<ExerciseRecordGroup[]> {
  const user = await requireUser();
  const store = await getStore();
  const [completed, exercises, notes] = await Promise.all([
    getCachedCompletedSessions(store, user.id),
    getCachedExercises(store),
    getCachedExerciseNotes(store, user.id),
  ]);
  return buildExerciseRecords(exercises, completed, notes);
}
