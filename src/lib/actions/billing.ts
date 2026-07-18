"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getServiceStore } from "@/lib/data";
import { toISODate } from "@/lib/domain/schedule";
import { voucherProblem } from "@/lib/domain/schemas";
import { getBillingProvider } from "@/lib/billing/provider";
import { isPro } from "@/lib/billing/entitlements";

async function appOrigin(): Promise<string> {
  return (
    (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? ""
  );
}

const startCheckoutSchema = z.object({
  interval: z.enum(["month", "year"]),
  voucherCode: z.string().trim().max(32).optional(),
});

/**
 * Start a subscription checkout and return the provider's hosted payment
 * URL. The caller awaits and then navigates with window.location (an
 * external URL — router.push doesn't apply). An optional voucher code is
 * validated against our own table before the provider ever sees it.
 */
export async function startCheckout(input: {
  interval: "month" | "year";
  voucherCode?: string;
}): Promise<string> {
  const user = await requireUser();
  const { interval, voucherCode } = startCheckoutSchema.parse(input);
  if (isPro(user)) throw new Error("You already have full access");

  // Billing writes are server-managed, so this whole path runs on the
  // service store (see the profiles trigger in 0013_billing_and_vouchers).
  const store = await getServiceStore();

  let discountPercentOff: number | undefined;
  let matchedVoucher: string | undefined;
  if (voucherCode) {
    const voucher = await store.getVoucherByCode(voucherCode);
    const problem = voucher
      ? voucherProblem(voucher, toISODate(new Date()))
      : "unknown code";
    if (!voucher || problem) {
      throw new Error(`That voucher can't be used (${problem}).`);
    }
    discountPercentOff = voucher.percentOff;
    matchedVoucher = voucher.code;
  }

  const provider = await getBillingProvider();
  const origin = await appOrigin();
  const session = await provider.createCheckout({
    userId: user.id,
    email: user.email,
    customerId:
      user.billingProvider === provider.name
        ? user.billingCustomerId
        : undefined,
    interval,
    discountPercentOff,
    voucherCode: matchedVoucher,
    successUrl: `${origin}/settings?checkout=success`,
    cancelUrl: `${origin}/settings?checkout=cancelled`,
  });

  if (session.customerId !== user.billingCustomerId) {
    await store.setProfileBillingCustomer(
      user.id,
      provider.name,
      session.customerId,
    );
  }
  return session.url;
}

/**
 * Hosted subscription management (plan, card, cancellation). Returns the
 * URL; the caller navigates with window.location.
 */
export async function openBillingManagement(): Promise<string> {
  const user = await requireUser();
  if (!user.billingCustomerId || !user.billingProvider) {
    throw new Error("No subscription to manage yet");
  }
  const provider = await getBillingProvider();
  if (user.billingProvider !== provider.name) {
    throw new Error(
      `This subscription is managed by ${user.billingProvider}, not ${provider.name}`,
    );
  }
  return provider.createManagementUrl(
    user.billingCustomerId,
    `${await appOrigin()}/settings`,
  );
}

/**
 * Preview a voucher for the paywall UI: what discount would apply? Returns
 * a problem message instead of throwing so typing a bad code isn't an error.
 */
export async function previewVoucher(
  code: string,
): Promise<{ percentOff: number } | { problem: string }> {
  await requireUser();
  const trimmed = code.trim();
  if (!trimmed) return { problem: "Enter a code" };
  const store = await getServiceStore();
  const voucher = await store.getVoucherByCode(trimmed);
  if (!voucher) return { problem: "Unknown code" };
  const problem = voucherProblem(voucher, toISODate(new Date()));
  if (problem) return { problem: `This code is ${problem}` };
  return { percentOff: voucher.percentOff };
}

/** Re-pull my subscription state from the provider (see billing/sync). */
export async function syncMySubscription(): Promise<void> {
  const user = await requireUser();
  const { syncSubscriptionForUser } = await import("@/lib/billing/sync");
  await syncSubscriptionForUser(user);
  revalidatePath("/settings");
}
