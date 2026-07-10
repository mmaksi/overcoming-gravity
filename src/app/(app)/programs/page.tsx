import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getStore } from "@/lib/data";
import {
  PERIODIZATION_LABELS,
  PROGRAM_TYPE_LABELS,
  SPLIT_TYPE_LABELS,
} from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const STATUS_VARIANT = {
  draft: "outline",
  active: "default",
  archived: "secondary",
} as const;

export default async function ProgramsPage() {
  const user = await requireUser();
  const store = await getStore();
  const programs = await store.listPrograms(user.id);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Programs</h1>
        <Button asChild size="sm">
          <Link href="/programs/new">
            <Plus className="size-4" /> New
          </Link>
        </Button>
      </div>

      {programs.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No programs yet</CardTitle>
            <CardDescription>
              Create your first program: pick a program type, the skills you
              want to learn, and design your mesocycle.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        programs.map((p) => (
          <Link key={p.id} href={`/programs/${p.id}`} className="block">
            <Card className="transition-colors hover:border-foreground/30">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  {p.name}
                  <Badge variant={STATUS_VARIANT[p.status]}>{p.status}</Badge>
                </CardTitle>
                <CardDescription>
                  {PROGRAM_TYPE_LABELS[p.type]}
                  {p.splitType ? ` · ${SPLIT_TYPE_LABELS[p.splitType]}` : ""}
                  {p.sport ? ` · ${p.sport.name}` : ""} · {p.weeks} weeks ·{" "}
                  {PERIODIZATION_LABELS[p.periodization]}
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))
      )}
    </div>
  );
}
