import Link from "next/link";
import { ChevronRight, Layers, Lock } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getStore } from "@/lib/data";
import { getCachedUserPrograms } from "@/lib/data/cached";
import { isPro } from "@/lib/billing/entitlements";
import {
  PERIODIZATION_LABELS,
  PROGRAM_TYPE_LABELS,
  SPLIT_TYPE_LABELS,
} from "@/lib/domain/types";
import { Badge } from "@/components/ui/badge";
import { CreateProgramCta } from "@/components/programs/create-program-cta";
import { IndividualWorkouts } from "@/components/workouts/individual-workouts";

export default async function ProgramsPage() {
  const user = await requireUser();
  const store = await getStore();
  // Cached per user for a day; program/workout/run mutations bust the tag.
  const { programs, runs, customWorkouts } = await getCachedUserPrograms(
    store,
    user.id,
  );
  // "Active" = programs the athlete is currently following (several can run
  // at the same time).
  const activeProgramIds = new Set(
    runs.filter((r) => r.status === "active").map((r) => r.programId),
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Training</h1>

      {/* Layered weeks: a mesocycle stacked into a program. */}
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Layers className="size-5 text-primary" /> Programs
        </h2>
        <p className="text-sm text-muted-foreground">
          Design a full mesocycle, set goals, periodization and a week-by-week
          plan.
        </p>
      </div>

      {/* Inviting create call-to-action; paywalled on the free plan. */}
      <CreateProgramCta
        locked={!isPro(user)}
        showTrial={!user.hadSubscription}
      />

      {programs.length === 0 ? (
        <div className="space-y-1 py-8 text-center">
          <p className="font-medium">No programs yet</p>
          <p className="text-sm text-muted-foreground">
            Tap “Create a program” above to build your first one.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {programs.map((p) => (
            <Link
              key={p.id}
              href={`/programs/${p.id}`}
              className="flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold">{p.name}</span>
                  {/* Lapsed plan: the row leads to the win-back paywall. */}
                  {!isPro(user) && (
                    <Lock className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  {activeProgramIds.has(p.id) && <Badge>Active</Badge>}
                  {p.status === "draft" && (
                    <Badge variant="outline">Draft</Badge>
                  )}
                </div>
                <p className="truncate text-sm text-muted-foreground">
                  {PROGRAM_TYPE_LABELS[p.type]}
                  {p.splitType ? ` · ${SPLIT_TYPE_LABELS[p.splitType]}` : ""}
                  {p.sport ? ` · ${p.sport.name}` : ""} · {p.weeks} weeks ·{" "}
                  {PERIODIZATION_LABELS[p.periodization]}
                </p>
              </div>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}

      {/* Standalone workouts: a title + exercises, no goals/periodization. */}
      <IndividualWorkouts
        workouts={customWorkouts}
        isProUser={isPro(user)}
        showTrial={!user.hadSubscription}
      />
    </div>
  );
}
