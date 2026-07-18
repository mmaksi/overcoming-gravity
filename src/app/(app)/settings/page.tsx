import { requireUser } from "@/lib/auth";
import { dataBackend, getStore } from "@/lib/data";
import { toISODate } from "@/lib/domain/schedule";
import { BodyStatsForm } from "@/components/settings/body-stats-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AdminToggle } from "@/components/settings/admin-toggle";
import { AvatarForm } from "@/components/settings/avatar-form";
import { FeedbackForm } from "@/components/settings/feedback-form";
import { NameForm } from "@/components/settings/name-form";
import { SignOutButton } from "@/components/settings/sign-out-button";
import { ThemePicker } from "@/components/settings/theme-picker";
import { WelcomeToggle } from "@/components/settings/welcome-toggle";

export default async function SettingsPage() {
  const user = await requireUser();
  const backend = dataBackend();
  const store = await getStore();
  const bodyweight = await store.listBodyweightEntries(user.id);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>
            Signed in as {user.name}
            {user.email ? ` (${user.email})` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <NameForm initialName={user.name} />
          <AvatarForm name={user.name} initialAvatarUrl={user.avatarUrl} />
          {backend === "json" ? (
            <AdminToggle isAdmin={user.isAdmin} />
          ) : (
            <SignOutButton />
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Body</CardTitle>
          <CardDescription>Track your weight and BMI.</CardDescription>
        </CardHeader>
        <CardContent>
          <BodyStatsForm
            initialHeightCm={user.heightCm}
            initialTargetWeightKg={user.targetWeightKg}
            entries={bodyweight}
            today={toISODate(new Date())}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ThemePicker />
          <WelcomeToggle initialShow={user.showWelcome} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Feedback</CardTitle>
        </CardHeader>
        <CardContent>
          <FeedbackForm />
        </CardContent>
      </Card>
    </div>
  );
}
