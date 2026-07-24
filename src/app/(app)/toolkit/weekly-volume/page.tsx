import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getStore } from "@/lib/data";
import {
  getCachedCompletedSessions,
  getCachedExercises,
} from "@/lib/data/cached";
import { toISODate } from "@/lib/domain/schedule";
import { buildWeeklyVolume, VOLUME_WEEKS } from "@/lib/domain/volume";
import { WeeklyVolume } from "@/components/tools/weekly-volume";

export default async function WeeklyVolumePage() {
  const user = await requireUser();
  const store = await getStore();

  const [sessions, exercises] = await Promise.all([
    getCachedCompletedSessions(store, user.id),
    getCachedExercises(store),
  ]);
  const weeks = buildWeeklyVolume(
    sessions,
    exercises,
    toISODate(new Date()),
    VOLUME_WEEKS,
  );

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <Link
          href="/toolkit"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Toolkit
        </Link>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Weekly volume</h1>
          <p className="text-sm text-muted-foreground">
            Working sets per movement pattern over the last {VOLUME_WEEKS}{" "}
            weeks. Use it to spot a pattern you&apos;ve been neglecting, and to
            see whether your volume is climbing, flat, or quietly slipping.
          </p>
        </div>
      </div>

      <WeeklyVolume weeks={weeks} />

      <p className="text-xs text-muted-foreground">
        Counts every recorded set of strength work — the only kind with a push,
        pull or legs pattern. Skills, warm-ups, prehab and stretching are left
        out. Exercises that train push and pull together are counted in their
        own column rather than split between the two.
      </p>
    </div>
  );
}
