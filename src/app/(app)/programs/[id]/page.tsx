import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Trophy } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getStore } from "@/lib/data";
import {
  GOAL_AREA_LABELS,
  GOAL_AREAS,
  PERIODIZATION_LABELS,
  PROGRAM_TYPE_LABELS,
  SPLIT_TYPE_LABELS,
  WEEKDAY_SHORT,
} from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StartRunButton } from "@/components/programs/start-run-button";
import { DeleteProgramButton } from "@/components/programs/delete-program-button";

export default async function ProgramPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const store = await getStore();

  const program = await store.getProgram(id);
  if (!program || program.userId !== user.id) notFound();

  const allRuns = await store.listRuns(user.id);
  const runs = allRuns
    .filter((r) => r.programId === id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const activeRun = runs.find((r) => r.status === "active");
  // An active run of a DIFFERENT program (would be ended by starting this one).
  const otherActiveRun = allRuns.find(
    (r) => r.status === "active" && r.programId !== id,
  );
  const otherActiveProgram = otherActiveRun
    ? await store.getProgram(otherActiveRun.programId)
    : null;
  const completedRuns = runs.filter((r) => r.status === "completed");
  const justFinished = runs.length > 0 && runs[0].status === "completed";

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <h1 className="text-2xl font-bold">{program.name}</h1>
        {/* "Active" is reserved for the program currently being followed. */}
        {activeRun ? (
          <Badge>Active</Badge>
        ) : program.status === "draft" ? (
          <Badge variant="outline">Draft</Badge>
        ) : null}
      </div>

      {justFinished && (
        <Alert>
          <Trophy className="size-4" />
          <AlertTitle>Program finished — nice work! 🎉</AlertTitle>
          <AlertDescription>
            You can repeat this program as many times as you like, or build a
            new one with harder progressions.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Overview</CardTitle>
          <CardDescription>
            {PROGRAM_TYPE_LABELS[program.type]}
            {program.splitType
              ? ` · ${SPLIT_TYPE_LABELS[program.splitType]}`
              : ""}
            {program.sport
              ? ` · ${program.sport.name} (${program.sport.days
                  .map((d) => WEEKDAY_SHORT[d])
                  .join(", ")})`
              : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {program.goals &&
            GOAL_AREAS.map(
              (area) =>
                program.goals![area].length > 0 && (
                  <Row
                    key={area}
                    label={`${GOAL_AREA_LABELS[area]} goals`}
                    value={program.goals![area]
                      .map((g) => `${g.done ? "✓ " : ""}${g.text}`)
                      .join(" · ")}
                  />
                ),
            )}
          <Row
            label="Periodization"
            value={PERIODIZATION_LABELS[program.periodization]}
          />
          <Row
            label="Length"
            value={`${program.weeks} weeks (week ${program.weeks} deload)`}
          />
          <Row
            label="Training days"
            value={program.trainingDays.map((d) => WEEKDAY_SHORT[d]).join(", ")}
          />
          {completedRuns.length > 0 && (
            <Row
              label="Completed runs"
              value={String(completedRuns.length)}
            />
          )}
        </CardContent>
      </Card>

      <div className="space-y-2">
        {program.status === "draft" ? (
          <Button asChild className="w-full">
            <Link href={`/programs/${program.id}/design`}>
              <Pencil className="size-4" /> Continue designing
            </Link>
          </Button>
        ) : (
          <>
            {activeRun ? (
              <Button asChild className="w-full">
                <Link href="/">Run in progress — go to dashboard</Link>
              </Button>
            ) : (
              <StartRunButton
                programId={program.id}
                trainingDays={program.trainingDays}
                activeRunProgramName={otherActiveProgram?.name ?? null}
                label={
                  completedRuns.length > 0 ? "Repeat program" : "Start program"
                }
              />
            )}
            <Button asChild variant="outline" className="w-full">
              <Link href={`/programs/${program.id}/design`}>
                <Pencil className="size-4" /> Edit workouts
              </Link>
            </Button>
          </>
        )}
        <DeleteProgramButton programId={program.id} />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
