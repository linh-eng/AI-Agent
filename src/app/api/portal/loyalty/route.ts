export const dynamic = "force-dynamic";
import { handle, ok } from "@/lib/api";
import { requirePortal } from "@/lib/portal-session";
import { loyaltySummary } from "@/lib/loyalty";

// GET — khách xem điểm/hạng/ví/voucher CỦA CHÍNH MÌNH (customerId lấy từ phiên portal).
export const GET = handle(async () => {
  const { customerId } = await requirePortal();
  const s = await loyaltySummary(customerId);
  // Chỉ whitelist trường an toàn (không lộ ghi chú nội bộ/audit).
  return ok({
    points: s.points, tier: s.tier, prepaidBalance: s.prepaidBalance,
    vouchers: s.vouchers.map((v: any) => ({ code: v.code, name: v.name, type: v.type, value: Number(v.value), expiresAt: v.expiresAt, status: v.status })),
    loyaltyTransactions: s.loyaltyTransactions.map((t: any) => ({ type: t.type, points: t.points, balanceAfter: t.balanceAfter, createdAt: t.createdAt })),
    prepaidTransactions: s.prepaidTransactions.map((t: any) => ({ type: t.type, amount: Number(t.amount), balanceAfter: Number(t.balanceAfter), createdAt: t.createdAt })),
  });
});
