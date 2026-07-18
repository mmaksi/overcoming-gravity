import "server-only";
import Stripe from "stripe";
import { SubscriptionSnapshot } from "@/lib/domain/schemas";
import { PLAN_PRICING, PlanInterval } from "./entitlements";
import { BillingProvider, CheckoutRequest, CheckoutSession } from "./provider";

/**
 * Stripe implementation of the BillingProvider seam. Products and prices are
 * found-or-created by lookup key on first use, so a fresh Stripe account
 * needs nothing but STRIPE_SECRET_KEY in the environment.
 */

const PRICE_LOOKUP: Record<PlanInterval, string> = {
  month: "calipro_month",
  year: "calipro_year",
};
const PRODUCT_NAME = "Strong Journal";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

/** The price id for an interval, creating product + price on first use. */
async function ensurePrice(interval: PlanInterval): Promise<string> {
  const stripe = getStripe();
  const lookupKey = PRICE_LOOKUP[interval];
  const existing = await stripe.prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 1,
  });
  if (existing.data[0]) return existing.data[0].id;

  // One shared product for both prices — reuse it if the other interval
  // already created it.
  const products = await stripe.products.search({
    query: `active:'true' AND name:'${PRODUCT_NAME}'`,
    limit: 1,
  });
  const product =
    products.data[0] ?? (await stripe.products.create({ name: PRODUCT_NAME }));

  const price = await stripe.prices.create({
    product: product.id,
    currency: "eur",
    unit_amount: PLAN_PRICING[interval].amountEur * 100,
    recurring: { interval },
    lookup_key: lookupKey,
  });
  return price.id;
}

/** A reusable percent-off coupon for app vouchers (first payment only). */
async function ensureCoupon(percentOff: number): Promise<string> {
  const stripe = getStripe();
  const id = `calipro-voucher-${percentOff}`;
  try {
    await stripe.coupons.retrieve(id);
    return id;
  } catch {
    const coupon = await stripe.coupons.create({
      id,
      percent_off: percentOff,
      duration: "once",
      name: `Voucher ${percentOff}% off`,
    });
    return coupon.id;
  }
}

/**
 * Normalize a Stripe subscription. `current_period_end` moved from the
 * subscription to its items in newer Stripe API versions — read both.
 */
export function toSnapshot(sub: Stripe.Subscription): SubscriptionSnapshot {
  const item = sub.items.data[0];
  const periodEnd =
    (item as { current_period_end?: number } | undefined)?.current_period_end ??
    (sub as unknown as { current_period_end?: number }).current_period_end;
  return {
    subscriptionId: sub.id,
    status: sub.status,
    interval: item?.price.recurring?.interval === "year" ? "year" : "month",
    periodEnd: periodEnd
      ? new Date(periodEnd * 1000).toISOString()
      : undefined,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
  };
}

/** Live-ish first: the subscription that should drive the user's plan. */
export function pickRelevantSubscription(
  subs: Stripe.Subscription[],
): Stripe.Subscription | null {
  const byPriority = (s: Stripe.Subscription) =>
    s.status === "active" || s.status === "trialing" || s.status === "past_due"
      ? 0
      : 1;
  return (
    [...subs].sort(
      (a, b) => byPriority(a) - byPriority(b) || b.created - a.created,
    )[0] ?? null
  );
}

export const stripeBilling: BillingProvider = {
  name: "stripe",

  async createCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
    const stripe = getStripe();
    const customerId =
      request.customerId ??
      (
        await stripe.customers.create({
          email: request.email,
          metadata: { app_user_id: request.userId },
        })
      ).id;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: await ensurePrice(request.interval), quantity: 1 }],
      discounts: request.discountPercentOff
        ? [{ coupon: await ensureCoupon(request.discountPercentOff) }]
        : undefined,
      success_url: request.successUrl,
      cancel_url: request.cancelUrl,
      metadata: {
        app_user_id: request.userId,
        voucher_code: request.voucherCode ?? "",
      },
      subscription_data: { metadata: { app_user_id: request.userId } },
    });
    if (!session.url) throw new Error("Stripe returned no checkout URL");
    return { url: session.url, customerId };
  },

  async createManagementUrl(
    customerId: string,
    returnUrl: string,
  ): Promise<string> {
    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return session.url;
  },

  async getSubscription(
    customerId: string,
  ): Promise<SubscriptionSnapshot | null> {
    const subs = await getStripe().subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 10,
    });
    const relevant = pickRelevantSubscription(subs.data);
    return relevant ? toSnapshot(relevant) : null;
  },
};
