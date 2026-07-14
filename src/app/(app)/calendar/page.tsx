import Link from "next/link";
import { CalendarDays, Check, ChevronLeft, ChevronRight, TrendingUp, X } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getStore } from "@/lib/data";
import {
  getCachedCompletedPage,
  getCachedExercises,
  getCachedUserPrograms,
} from "@/lib/data/cached";
import {
  addDays,
  parseISODate,
  toISODate,
  weekdayOf,
} from "@/lib/domain/schedule";
import { WEEKDAY_SHORT, WEEKDAYS } from "@/lib/domain/types";
import {
  buildHistoryItems,
  HISTORY_PAGE_SIZE,
  makeSessionLabel,
} from "@/lib/domain/history";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HistoryFeed } from "@/components/history/history-feed";
import { ProgressTab } from "@/components/history/progress-tab";
import { cn } from "@/lib/utils";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const user = await requireUser();
  const store = await getStore();

  const now = new Date();
  const [year, month] = /^\d{4}-\d{2}$/.test(monthParam ?? "")
    ? monthParam!.split("-").map(Number)
    : [now.getFullYear(), now.getMonth() + 1];

  const firstOfMonth = new Date(year, month - 1, 1);
  // Grid starts on the Monday of the week containing the 1st.
  const gridStart = addDays(firstOfMonth, -((firstOfMonth.getDay() + 6) % 7));
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const gridEnd = cells[cells.length - 1];

  const sessions = await store.listSessionsByUser(
    user.id,
    toISODate(gridStart),
    toISODate(gridEnd),
  );
  // Several programs can run in parallel, so a date may hold many sessions.
  const sessionsByDate = new Map<string, typeof sessions>();
  for (const s of sessions) {
    const list = sessionsByDate.get(s.date) ?? [];
    list.push(s);
    sessionsByDate.set(s.date, list);
  }

  // Sport days of active runs (sport-mix programs).
  const runs = (await store.listRuns(user.id)).filter(
    (r) => r.status === "active",
  );
  const sportByDate = new Map<string, string>();
  for (const run of runs) {
    const program = await store.getProgram(run.programId);
    if (!program?.sport) continue;
    const start = parseISODate(run.startDate);
    for (let i = 0; i < program.weeks * 7; i++) {
      const date = addDays(start, i);
      if (program.sport.days.includes(weekdayOf(date))) {
        sportByDate.set(toISODate(date), program.sport.name);
      }
    }
  }

  const prev = month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, "0")}`;
  const next = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
  const todayISO = toISODate(now);

  // History (moved here from the old History tab): only the newest page is
  // fetched up front — older workouts stream in on scroll, and the Progress
  // tab loads its rows on first visit. All three reads are cached per user.
  const [firstPage, exercises, { programs, runs: labelRuns, customWorkouts }] =
    await Promise.all([
      getCachedCompletedPage(store, user.id, 0, HISTORY_PAGE_SIZE),
      getCachedExercises(store),
      getCachedUserPrograms(store, user.id),
    ]);
  const historyItems = buildHistoryItems(
    firstPage,
    new Map(exercises.map((e) => [e.id, e])),
    makeSessionLabel(programs, labelRuns, customWorkouts),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <div className="flex items-center gap-1">
          <Link
            href={`/calendar?month=${prev}`}
            className="rounded-md border p-1.5 hover:bg-muted"
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" />
          </Link>
          <span className="min-w-32 text-center text-sm font-medium">
            {MONTHS[month - 1]} {year}
          </span>
          <Link
            href={`/calendar?month=${next}`}
            className="rounded-md border p-1.5 hover:bg-muted"
            aria-label="Next month"
          >
            <ChevronRight className="size-4" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground">
        {WEEKDAYS.map((d) => (
          <div key={d}>{WEEKDAY_SHORT[d]}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((date) => {
          const iso = toISODate(date);
          const inMonth = date.getMonth() === month - 1;
          const daySessions = sessionsByDate.get(iso) ?? [];
          const sport = sportByDate.get(iso);

          return (
            <div
              key={iso}
              className={cn(
                "flex aspect-square flex-col items-center justify-start gap-0.5 rounded-lg border p-1 text-xs",
                !inMonth && "opacity-35",
                iso === todayISO && "border-primary ring-1 ring-primary",
                daySessions.length > 0 && "bg-muted/50",
              )}
            >
              <span className={cn(iso === todayISO && "font-bold text-primary")}>
                {date.getDate()}
              </span>
              {daySessions.length > 0 && (
                <span className="flex flex-wrap items-center justify-center gap-0.5">
                  {daySessions.slice(0, 3).map((session) => (
                    <Link
                      key={session.id}
                      href={`/workout/${session.id}`}
                      aria-label={`Workout on ${iso}`}
                      className={cn(
                        "flex size-4 items-center justify-center rounded-full",
                        session.status === "completed" &&
                          "bg-green-500/15 text-green-600",
                        session.status === "skipped" &&
                          "bg-muted text-muted-foreground",
                        session.status === "planned" &&
                          "bg-primary/15 text-primary",
                      )}
                    >
                      {session.status === "completed" ? (
                        <Check className="size-3" />
                      ) : session.status === "skipped" ? (
                        <X className="size-3" />
                      ) : (
                        <span className="size-1.5 rounded-full bg-current" />
                      )}
                    </Link>
                  ))}
                </span>
              )}
              {sport && (
                <span className="w-full truncate rounded bg-violet-500/15 px-0.5 text-[9px] text-violet-600 dark:text-violet-400">
                  {sport}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-primary" /> planned
        </span>
        <span className="flex items-center gap-1">
          <Check className="size-3 text-green-600" /> completed
        </span>
        <span className="flex items-center gap-1">
          <X className="size-3" /> skipped
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2 rounded bg-violet-500/40" /> sport day
        </span>
      </div>

      {/* History + progress, merged in from the old separate History tab. */}
      <Tabs defaultValue="workouts" className="pt-2">
        <TabsList className="h-auto w-full p-1">
          <TabsTrigger
            value="workouts"
            className="flex-1 gap-2 py-3 text-base [&_svg:not([class*='size-'])]:size-5"
          >
            <CalendarDays /> Workouts
          </TabsTrigger>
          <TabsTrigger
            value="progress"
            className="flex-1 gap-2 py-3 text-base [&_svg:not([class*='size-'])]:size-5"
          >
            <TrendingUp /> Progress
          </TabsTrigger>
        </TabsList>

        <TabsContent value="workouts" className="pt-3">
          <HistoryFeed
            initialItems={historyItems}
            initialHasMore={firstPage.length === HISTORY_PAGE_SIZE}
          />
        </TabsContent>

        <TabsContent value="progress" className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            Your current progression, method and best set in every skill and
            strength exercise — so you know exactly what to do next workout.
          </p>
          <ProgressTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
