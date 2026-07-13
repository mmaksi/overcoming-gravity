import { requireUser } from "@/lib/auth";
import { dataBackend } from "@/lib/data";
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

export default async function SettingsPage() {
  const user = await requireUser();
  const backend = dataBackend();

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
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            Light, dark, or follow your device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ThemePicker />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Feedback</CardTitle>
          <CardDescription>
            Something broken or missing? We read every message.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FeedbackForm />
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        Data backend: {backend === "json" ? "local JSON (development)" : "Supabase"}
      </p>
    </div>
  );
}
