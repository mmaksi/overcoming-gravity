import { ProgramWizard } from "@/components/wizard/program-wizard";

export default function NewProgramPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">New program</h1>
      <ProgramWizard />
    </div>
  );
}
