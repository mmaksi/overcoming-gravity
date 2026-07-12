import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getStore } from "@/lib/data";
import {
  PERIODIZATION_LABELS,
  PROGRAM_TYPE_LABELS,
  SPLIT_TYPE_LABELS,
} from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IndividualWorkouts } from "@/components/workouts/individual-workouts";

export default async function ProgramsPage() {
  const user = await requireUser();
  const store = await getStore();
  const [programs, runs, customWorkouts] = await Promise.all([
    store.listPrograms(user.id),
    store.listRuns(user.id),
    store.listCustomWorkouts(user.id),
  ]);
  // "Active" = programs the athlete is currently following (several can run
  // at the same time).
  const activeProgramIds = new Set(
    runs.filter((r) => r.status === "active").map((r) => r.programId),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Programs</h1>
        <Button asChild>
          <Link href="/programs/new">
            <Plus className="size-4" /> New
          </Link>
        </Button>
      </div>

      {programs.length === 0 ? (
        <div className="space-y-1 py-8 text-center">
          <p className="font-medium">No programs yet</p>
          <p className="text-sm text-muted-foreground">
            Create your first program: pick a program type, the skills you want
            to learn, and design your mesocycle.
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
