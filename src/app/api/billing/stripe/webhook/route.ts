import Stripe from "stripe";
import { getServiceStore } from "@/lib/data";
import { getStripe, toSnapshot } from "@/lib/billing/stripe";

/**
 * Stripe → app sync. Signature-verified; keeps profiles' subscription
 * snapshot current across renewals, plan switches and cancellations, and
 * counts voucher redemptions when a discounted checkout completes.
 *
 * Provider-specific by design: each payment provider gets its own webhook
 * route speaking its own dialect; everything downstream goes through the
 * provider-neutral DataStore seam. The proxy auth gate skips /api/billing.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set — webhook rejected");
    return new Response("webhook not configured", { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      await request.text(),
      signature,
      secret,
    );
  } catch {
    return new Response("invalid signature", { status: 400 });
  }

  const store = await getServiceStore();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const voucherCode = session.metadata?.voucher_code;
      if (voucherCode) {
        const voucher = await store.getVoucherByCode(voucherCode);
        if (voucher) await store.incrementVoucherRedemptions(voucher.id);
      }
      if (typeof session.subscription === "string" && session.customer) {
        const sub = await getStripe().subscriptions.retrieve(
          session.subscription,
        );
        await store.applySubscription(
          "stripe",
          typeof session.customer === "string"
            ? session.customer
            : session.customer.id,
          toSnapshot(sub),
        );
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      const customerId =
        typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      await store.applySubscription("stripe", customerId, toSnapshot(sub));
      break;
    }
    default:
      // Not subscribed to anything else — acknowledge and move on.
      break;
  }

  return new Response(null, { status: 200 });
}
