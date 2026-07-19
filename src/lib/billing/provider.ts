import "server-only";
import { SubscriptionSnapshot } from "@/lib/domain/schemas";
import { PlanInterval } from "./entitlements";

/**
 * The payment-provider seam, mirroring the DataStore seam: the app talks
 * subscriptions, checkout URLs and management URLs — never a concrete
 * provider's API. Stripe is the first implementation (see stripe.ts); a
 * second provider only needs this interface plus its own webhook route.
 */

export type CheckoutRequest = {
  userId: string;
  email?: string;
  /** The provider customer already backing this user, if any. */
  customerId?: string;
  interval: PlanInterval;
  /** Free-trial length before the first charge; omitted = no trial. */
  trialDays?: number;
  /** Percent discount from an app-validated voucher (providers apply it their own way). */
  discountPercentOff?: number;
  /** The voucher's code, echoed back in webhook metadata so redemptions get counted. */
  voucherCode?: string;
  successUrl: string;
  cancelUrl: string;
};

export type CheckoutSession = {
  /** Hosted payment page to send the user to. */
  url: string;
  /** The (possibly just created) provider customer backing the user. */
  customerId: string;
};

export interface BillingProvider {
  /** Stable identifier stored on the profile (e.g. "stripe"). */
  readonly name: string;
  createCheckout(request: CheckoutRequest): Promise<CheckoutSession>;
  /** Hosted page where the customer manages plan, card and cancellation. */
  createManagementUrl(customerId: string, returnUrl: string): Promise<string>;
  /** The customer's current subscription, provider-normalized; null if none. */
  getSubscription(customerId: string): Promise<SubscriptionSnapshot | null>;
}

/** The configured provider (BILLING_PROVIDER env, default "stripe"). */
export async function getBillingProvider(): Promise<BillingProvider> {
  const name = process.env.BILLING_PROVIDER ?? "stripe";
  if (name === "stripe") {
    const { stripeBilling } = await import("./stripe");
    return stripeBilling;
  }
  throw new Error(`Unknown BILLING_PROVIDER: ${name}`);
}
