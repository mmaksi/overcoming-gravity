import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { IsometricSweetSpot } from "@/components/tools/isometric-sweet-spot";

export default function IsometricSweetSpotPage() {
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <Link
          href="/toolkit"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Tools
        </Link>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Isometric sweet spot</h1>
          <p className="text-sm text-muted-foreground">
            Find the sets and hold duration that build the most strength for
            your current level. Enter how long you can hold the position, and
            we&apos;ll recommend your sweet spot.
          </p>
        </div>
      </div>

      <IsometricSweetSpot />
    </div>
  );
}
