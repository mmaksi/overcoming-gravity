import Link from "next/link";
import { Dumbbell, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-6 px-6 text-center">
      <Dumbbell className="size-14 text-primary" />
      <div className="space-y-2">
        <p className="text-5xl font-black tabular-nums">404</p>
        <h1 className="text-2xl font-bold">Reps Not Found</h1>
        <p className="text-muted-foreground">
          Someone skipped leg day… and this page. It&apos;s not in the program.
        </p>
      </div>
      <Button asChild size="lg">
        <Link href="/">
          <Home className="size-4" /> Back to base
        </Link>
      </Button>
    </div>
  );
}
