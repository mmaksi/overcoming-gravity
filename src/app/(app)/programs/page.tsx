import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getStore } from "@/lib/data";
import { getCachedUserPrograms } from "@/lib/data/cached";
import {
  PERIODIZATION_LABELS,
  PROGRAM_TYPE_LABELS,
  SPLIT_TYPE_LABELS,
} from "@/lib/domain/types";
import { Badge } from "@/components/ui/badge";
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
      <h1 className="text-2xl font-bold">Programs</h1>

      {/* Inviting create call-to-action in place of a small header button. */}
      <Link
        href="/programs/new"
        className="group flex items-center gap-3 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-4 transition-colors hover:border-primary hover:bg-primary/10"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary transition-transform group-hover:scale-105">
          <Plus className="size-6" />
        </span>
        <span className="min-w-0">
          <span className="block font-semibold">Create a program</span>
          <span className="block text-sm text-muted-foreground">
            Pick a type, choose your skills, design the mesocycle.
          </span>
        </span>
        <ChevronRight className="ml-auto size-5 shrink-0 text-muted-foreground" />
      </Link>

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
      <IndividualWorkouts workouts={customWorkouts} />
    </div>
  );
}
