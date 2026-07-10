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
import { SignOutButton } from "@/components/settings/sign-out-button";

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
        <CardContent>
          {backend === "json" ? (
            <AdminToggle isAdmin={user.isAdmin} />
          ) : (
            <SignOutButton />
          )}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        Data backend: {backend === "json" ? "local JSON (development)" : "Supabase"}
      </p>
    </div>
  );
}
