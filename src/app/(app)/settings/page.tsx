import { requireUser } from "@/lib/auth";
import { dataBackend, getStore } from "@/lib/data";
import { toISODate } from "@/lib/domain/schedule";
import { syncSubscriptionForUser } from "@/lib/billing/sync";
import { BillingRefresh } from "@/components/settings/billing-refresh";
import { BillingSection } from "@/components/settings/billing-section";
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
import { TipsToggle } from "@/components/settings/tips-toggle";

export default async function SettingsPage({
  searchParams,
}: {
  // `billing=updated` (the portal return URL) needs no special casing —
  // any visit with a billing customer syncs below.
  searchParams: Promise<{ checkout?: string }>;
}) {
  let user = await requireUser();
  const { checkout } = await searchParams;

  // Anyone with a billing customer gets a fresh pull from the provider on
  // every visit — a cancellation made on the portal (or a missed webhook)
  // must never show as "renews". One provider call, billing users only.
  if (user.billingCustomerId) {
    await syncSubscriptionForUser(user);
    user = await requireUser();
  }

  const backend = dataBackend();
  const store = await getStore();
  const bodyweight = await store.listBodyweightEntries(user.id);

  return (
    <div className="space-y-4">
      {/* Coming back from a hosted checkout/portal must re-run the sync
          above even when the browser restores this page from bfcache. */}
      {user.billingCustomerId && <BillingRefresh />}
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
          <CardTitle>Plan</CardTitle>
          <CardDescription>
            Your subscription, card and invoices.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BillingSection
            isAdmin={user.isAdmin}
            plan={user.plan}
            planInterval={user.planInterval}
            planRenewsAt={user.planRenewsAt}
            planCancelAtPeriodEnd={user.planCancelAtPeriodEnd}
            justUpgraded={checkout === "success" && user.plan === "pro"}
            showTrial={!user.hadSubscription}
          />
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
          {/* On while either tip is still pending; writes both together. */}
          <TipsToggle
            initialShow={user.showWelcome || user.showDesignerIntro}
          />
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
