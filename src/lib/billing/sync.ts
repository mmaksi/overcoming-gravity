import "server-only";
import { Profile } from "@/lib/domain/schemas";
import { getServiceStore } from "@/lib/data";
import { getBillingProvider } from "./provider";

/**
 * Pull the user's subscription state from the payment provider and store it.
 * The safety net that makes a finished checkout reflect immediately on the
 * success redirect — before (or without) webhooks being configured. Failures
 * are logged, not thrown: the webhook remains the source of truth.
 */
export async function syncSubscriptionForUser(user: Profile): Promise<void> {
  if (!user.billingCustomerId || !user.billingProvider) return;
  try {
    const provider = await getBillingProvider();
    if (provider.name !== user.billingProvider) return;
    const snapshot = await provider.getSubscription(user.billingCustomerId);
    const store = await getServiceStore();
    await store.applySubscription(
      provider.name,
      user.billingCustomerId,
      snapshot,
    );
  } catch (error) {
    console.error("subscription sync failed:", error);
  }
}
