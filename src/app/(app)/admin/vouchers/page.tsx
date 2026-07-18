import { getStore } from "@/lib/data";
import { toISODate } from "@/lib/domain/schedule";
import { VouchersManager } from "@/components/admin/vouchers-manager";

export default async function AdminVouchersPage() {
  // The admin layout gates this route; RLS additionally restricts the
  // vouchers table to admins.
  const store = await getStore();
  const vouchers = await store.listVouchers();
  return <VouchersManager vouchers={vouchers} today={toISODate(new Date())} />;
}
