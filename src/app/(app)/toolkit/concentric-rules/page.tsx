import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const rules = [
  {
    n: 1,
    title: "Perform your max minus one",
    body: "On each set, stop one rep short of your true maximum. Working at max−1 keeps every set high quality and leaves enough in the tank to accumulate volume.",
  },
  {
    n: 2,
    title: "Total-rep target per muscle group",
    body: "Aim for minimum 15 total reps per exercise. A good guideline for total volume of reps per push/pull/leg group is as follows:",
    ranges: [
      { label: "Strength", value: "25–50 total reps" },
      { label: "Hypertrophy", value: "40–75+ total reps" },
    ],
  },
  {
    n: 3,
    title: "10 sets per muscle group (hypertrophy)",
    body: "For muscle growth, aim for about 10 sets per muscle group across your session. Spread that volume across exercises that hit the same muscle.",
  },
];

export default function ConcentricRulesPage() {
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
          <h1 className="text-2xl font-bold">Concentric rules</h1>
          <p className="text-sm text-muted-foreground">
            Three rules for programming concentric (rep-based) exercises so your
            sets drive real strength and hypertrophy.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {rules.map((rule) => (
          <Card key={rule.n}>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {rule.n}
                </span>
                {rule.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{rule.body}</p>
              {rule.ranges && (
                <div className="flex flex-wrap gap-2">
                  {rule.ranges.map((r) => (
                    <div
                      key={r.label}
                      className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2"
                    >
                      <Badge variant="secondary">{r.label}</Badge>
                      <span className="text-sm font-medium">{r.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
