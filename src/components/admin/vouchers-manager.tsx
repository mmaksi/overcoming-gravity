"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { BadgePercent, Loader2, Plus, Trash2 } from "lucide-react";
import { Voucher, voucherProblem } from "@/lib/domain/schemas";
import { createVoucher, removeVoucher } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** A voucher's current standing, for the status chip. */
function statusOf(voucher: Voucher, today: string): string {
  return voucherProblem(voucher, today) ?? "active";
}

/**
 * Admin management of discount codes: create with an optional validity
 * window and redemption cap, see standing at a glance, delete. Discounts
 * apply to the buyer's first payment at checkout.
 */
export function VouchersManager({
  vouchers,
  today,
}: {
  vouchers: Voucher[];
  today: string;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [percentOff, setPercentOff] = useState("20");
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({ mutationFn: createVoucher });
  const removeMutation = useMutation({ mutationFn: removeVoucher });

  function submit() {
    setError(null);
    createMutation
      .mutateAsync({
        code: code.trim(),
        percentOff: Number(percentOff),
        validFrom: validFrom || undefined,
        validUntil: validUntil || undefined,
        maxRedemptions: maxRedemptions ? Number(maxRedemptions) : undefined,
      })
      .then(() => {
        setCode("");
        setMaxRedemptions("");
        setValidFrom("");
        setValidUntil("");
        router.refresh();
      })
      .catch((e: Error) => setError(e.message || "Could not create voucher"));
  }

  function remove(id: string) {
    removeMutation
      .mutateAsync(id)
      .then(() => router.refresh())
      .catch(() => undefined);
  }

  const canSubmit =
    code.trim().length >= 3 &&
    Number(percentOff) >= 1 &&
    Number(percentOff) <= 100 &&
    !createMutation.isPending;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BadgePercent className="size-5 text-primary" /> New voucher
          </CardTitle>
          <CardDescription>
            The discount applies to the buyer&apos;s first payment. Leave the
            dates empty for a code that always works.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="voucher-code">Code</Label>
              <Input
                id="voucher-code"
                placeholder="LAUNCH20"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="uppercase"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="voucher-percent">Discount %</Label>
              <Input
                id="voucher-percent"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={percentOff}
                onChange={(e) =>
                  setPercentOff(e.target.value.replace(/\D/g, ""))
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="voucher-from">Valid from</Label>
              <Input
                id="voucher-from"
                type="date"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="voucher-until">Valid until</Label>
              <Input
                id="voucher-until"
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="voucher-max">Max redemptions (optional)</Label>
            <Input
              id="voucher-max"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="Unlimited"
              value={maxRedemptions}
              onChange={(e) =>
                setMaxRedemptions(e.target.value.replace(/\D/g, ""))
              }
            />
          </div>
          <Button disabled={!canSubmit} onClick={submit}>
            {createMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <Plus className="size-4" /> Create voucher
              </>
            )}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {vouchers.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No vouchers yet.
        </p>
      ) : (
        <div className="space-y-2">
          {vouchers.map((v) => {
            const status = statusOf(v, today);
            return (
              <div
                key={v.id}
                className="flex items-center gap-3 rounded-xl border p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2">
                    <span className="font-mono font-semibold">{v.code}</span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                        status === "active"
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {status}
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {v.percentOff}% off
                    {v.validFrom || v.validUntil
                      ? ` · ${v.validFrom ?? "…"} → ${v.validUntil ?? "…"}`
                      : " · no expiry"}
                    {" · "}
                    {v.redemptions}
                    {v.maxRedemptions ? ` / ${v.maxRedemptions}` : ""} used
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete voucher ${v.code}`}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  disabled={removeMutation.isPending}
                  onClick={() => remove(v.id)}
                >
                  <Trash2 className="size-5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
