import { Lock } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { isPro } from "@/lib/billing/entitlements";
import { PlanCards } from "@/components/billing/paywall";
import { ProgramWizard } from "@/components/wizard/program-wizard";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function NewProgramPage() {
  const user = await requireUser();

  // Deep links included: free accounts see the offer, not the wizard.
  if (!isPro(user)) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">New program</h1>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="size-5 text-primary" /> Unlock the full app
            </CardTitle>
            <CardDescription>
              The program designer is part of the full Strong Journal experience.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PlanCards showTrial={!user.hadSubscription} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">New program</h1>
      <ProgramWizard />
    </div>
  );
}
