import { describe, expect, it } from "vitest";
import { planFromStatus, Voucher, voucherProblem } from "./schemas";

describe("planFromStatus", () => {
  it("grants pro to live subscriptions (with past_due as grace)", () => {
    expect(planFromStatus("active")).toBe("pro");
    expect(planFromStatus("trialing")).toBe("pro");
    expect(planFromStatus("past_due")).toBe("pro");
  });

  it("everything else is free", () => {
    expect(planFromStatus("canceled")).toBe("free");
    expect(planFromStatus("incomplete_expired")).toBe("free");
    expect(planFromStatus(null)).toBe("free");
    expect(planFromStatus(undefined)).toBe("free");
  });
});

function voucher(partial: Partial<Voucher>): Voucher {
  return {
    id: "v1",
    code: "LAUNCH20",
    percentOff: 20,
    redemptions: 0,
    createdAt: "2026-01-01T00:00:00Z",
    ...partial,
  };
}

describe("voucherProblem", () => {
  it("is usable with no window and no cap", () => {
    expect(voucherProblem(voucher({}), "2026-07-18")).toBeNull();
  });

  it("respects the validity window inclusively", () => {
    const v = voucher({ validFrom: "2026-07-01", validUntil: "2026-07-31" });
    expect(voucherProblem(v, "2026-06-30")).toBe("not yet valid");
    expect(voucherProblem(v, "2026-07-01")).toBeNull();
    expect(voucherProblem(v, "2026-07-31")).toBeNull();
    expect(voucherProblem(v, "2026-08-01")).toBe("expired");
  });

  it("stops at the redemption cap", () => {
    const v = voucher({ maxRedemptions: 2, redemptions: 2 });
    expect(voucherProblem(v, "2026-07-18")).toBe("fully redeemed");
    expect(
      voucherProblem(voucher({ maxRedemptions: 2, redemptions: 1 }), "2026-07-18"),
    ).toBeNull();
  });
});
