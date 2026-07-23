import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getStore } from "@/lib/data";
import { getCachedExercises } from "@/lib/data/cached";
import { ExerciseLibrary } from "@/components/exercise/exercise-library";

export default async function ExerciseLibraryPage() {
  // Read-only catalog browser — free for every plan. Cached per request.
  const store = await getStore();
  const exercises = await getCachedExercises(store);

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
          <h1 className="text-2xl font-bold">Exercise library</h1>
          <p className="text-sm text-muted-foreground">
            Browse every exercise and its progressions.
          </p>
        </div>
      </div>

      <ExerciseLibrary exercises={exercises} />
    </div>
  );
}
