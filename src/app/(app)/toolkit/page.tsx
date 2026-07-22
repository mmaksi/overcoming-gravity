import Link from "next/link";
import { ChevronRight, Dumbbell, Repeat, Timer } from "lucide-react";
import { getStore } from "@/lib/data";
import { getCachedExercises } from "@/lib/data/cached";
import { Card, CardContent } from "@/components/ui/card";
import { ExerciseLibrary } from "@/components/exercise/exercise-library";

// Insight/decision helpers for athletes. Each tool is a self-contained page;
// this hub just lists them.
const tools = [
  {
    href: "/toolkit/isometric-sweet-spot",
    title: "Isometric sweet spot",
    description:
      "Enter your max hold and get the recommended sets × hold to train.",
    icon: Timer,
  },
  {
    href: "/toolkit/one-rep-max",
    title: "1 rep max calculator",
    description:
      "Estimate your 1RM from a set — barbell or weighted calisthenics.",
    icon: Dumbbell,
  },
  {
    href: "/toolkit/concentric-rules",
    title: "Concentric rules",
    description:
      "The three rules for programming concentric exercises effectively.",
    icon: Repeat,
  },
];

export default async function ToolkitPage() {
  // Read-only catalog browser — free for every plan. Cached per request.
  const store = await getStore();
  const exercises = await getCachedExercises(store);

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Toolkit</h1>
          <p className="text-sm text-muted-foreground">
            Helpers to make training decisions and get insights.
          </p>
        </div>

        <div className="space-y-3">
          {tools.map(({ href, title, description, icon: Icon }) => (
            <Link key={href} href={href} className="block">
              <Card className="transition-colors hover:bg-muted/50">
                <CardContent className="flex items-center gap-4">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-heading font-medium">{title}</p>
                    <p className="text-sm text-muted-foreground">
                      {description}
                    </p>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <ExerciseLibrary exercises={exercises} />
    </div>
  );
}
