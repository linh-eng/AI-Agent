// =============================================================================
// D4 — DOANH THU GHI NHẬN (recognized revenue) theo BUỔI.
//   * TÁCH khỏi tiền thực thu (cash): cash = Payment/Deposit (đã có). Recognized
//     revenue = giá TẠI THỜI ĐIỂM GIAO DỊCH gắn buổi ĐÃ HOÀN THÀNH.
//   * KHÔNG dùng Service.standardPrice hiện hành. Nguồn (ưu tiên, deterministic):
//       1) COMPLIMENTARY — buổi tặng/miễn phí (cờ isComplimentary) → 0 có chủ đích.
//       2) BOOKING_ITEM — BookingItem.priceSnapshot khớp serviceId (giá bán lần đến).
//       3) BOOKING_PRICE — Booking.price (khi không có item khớp).
//       4) PACKAGE_ALLOCATION — gói/liệu trình: chia ĐỀU giá gói theo SỐ BUỔI.
//       5) SESSION_PRICE — TreatmentSession.price (nhập tay) nếu có.
//       6) UNKNOWN — chưa xác định được (amount null).
//   * ĐÔNG CỨNG khi COMPLETED (idempotent); đổi giá/gói về sau KHÔNG đổi số đã ghi.
//   * Hoàn/hủy sau ghi nhận = BÚT TOÁN ĐẢO (recognizedReversedAt) — giữ số cũ, loại
//     khỏi tổng. KHÔNG sửa/không xóa.
// =============================================================================
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";

type Db = PrismaClient | Prisma.TransactionClient;
const num = (v: any) => (v == null ? 0 : Number(v));

export interface RecognizedResult {
  amount: number | null; // null = UNKNOWN (chưa xác định); 0 = complimentary có chủ đích
  source: "COMPLIMENTARY" | "BOOKING_ITEM" | "BOOKING_PRICE" | "PACKAGE_ALLOCATION" | "SESSION_PRICE" | "UNKNOWN";
  snapshot: Record<string, unknown>;
}

/** Suy doanh thu ghi nhận cho 1 buổi (deterministic, READ-ONLY). */
export async function resolveRecognizedRevenue(sessionId: string, db: Db = defaultPrisma): Promise<RecognizedResult> {
  const s = await db.treatmentSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true, serviceId: true, planId: true, bookingId: true, price: true, isComplimentary: true,
      booking: { select: { id: true, price: true, items: { select: { serviceId: true, priceSnapshot: true } } } },
    },
  });
  if (!s) return { amount: null, source: "UNKNOWN", snapshot: { reason: "session-not-found" } };

  // (1) Buổi tặng/miễn phí — 0 CÓ CHỦ ĐÍCH.
  if (s.isComplimentary) return { amount: 0, source: "COMPLIMENTARY", snapshot: {} };

  // (2)(3) Có booking → giá bán lần đến (item khớp serviceId, else Booking.price).
  if (s.booking) {
    const item = (s.booking.items ?? []).find((it) => s.serviceId && it.serviceId === s.serviceId && it.priceSnapshot != null)
      ?? (s.booking.items ?? []).find((it) => it.priceSnapshot != null);
    if (item?.priceSnapshot != null) {
      return { amount: num(item.priceSnapshot), source: "BOOKING_ITEM", snapshot: { bookingId: s.booking.id, serviceId: item.serviceId } };
    }
    if (s.booking.price != null) {
      return { amount: num(s.booking.price), source: "BOOKING_PRICE", snapshot: { bookingId: s.booking.id } };
    }
  }

  // (4) Gói/liệu trình — chia ĐỀU giá gói theo SỐ BUỔI của phác đồ.
  if (s.planId) {
    const [plan, invAgg, sessionCount] = await Promise.all([
      db.treatmentPlan.findUnique({ where: { id: s.planId }, select: { totalPrice: true } }),
      db.invoice.aggregate({ _sum: { total: true }, where: { planId: s.planId, status: { not: "CANCELLED" } } }),
      db.treatmentSession.count({ where: { planId: s.planId } }),
    ]);
    const invoiceTotal = num(invAgg._sum.total);
    const packageTotal = invoiceTotal > 0 ? invoiceTotal : num(plan?.totalPrice);
    if (packageTotal > 0 && sessionCount > 0) {
      const per = Math.round((packageTotal / sessionCount) * 100) / 100;
      return { amount: per, source: "PACKAGE_ALLOCATION", snapshot: { planId: s.planId, packageTotal, sessionCount, basis: invoiceTotal > 0 ? "invoice" : "plan.totalPrice" } };
    }
  }

  // (5) Giá nhập tay của buổi.
  if (s.price != null) return { amount: num(s.price), source: "SESSION_PRICE", snapshot: {} };

  // (6) Không xác định được.
  return { amount: null, source: "UNKNOWN", snapshot: {} };
}

/** ĐÔNG CỨNG doanh thu ghi nhận khi buổi COMPLETED. Idempotent (đã ghi → giữ nguyên). */
export async function freezeRecognizedRevenue(sessionId: string, db: Db = defaultPrisma): Promise<RecognizedResult & { alreadyFrozen: boolean }> {
  const cur = await db.treatmentSession.findUnique({ where: { id: sessionId }, select: { recognizedAt: true } });
  if (cur?.recognizedAt) {
    const s = await db.treatmentSession.findUnique({ where: { id: sessionId }, select: { recognizedRevenue: true, recognizedRevenueSource: true, recognizedRevenueSnapshot: true } });
    return { amount: s?.recognizedRevenue == null ? null : Number(s.recognizedRevenue), source: (s?.recognizedRevenueSource as any) ?? "UNKNOWN", snapshot: (s?.recognizedRevenueSnapshot as any) ?? {}, alreadyFrozen: true };
  }
  const r = await resolveRecognizedRevenue(sessionId, db);
  await db.treatmentSession.update({
    where: { id: sessionId },
    data: {
      recognizedRevenue: r.amount == null ? null : (r.amount as any),
      recognizedRevenueSource: r.source,
      recognizedRevenueSnapshot: r.snapshot as any,
      recognizedAt: new Date(),
    },
  });
  return { ...r, alreadyFrozen: false };
}

/** BÚT TOÁN ĐẢO khi hoàn/hủy sau khi đã ghi nhận. Giữ số cũ; loại khỏi tổng. Idempotent. */
export async function reverseRecognizedRevenue(sessionId: string, opts: { reason: string; by?: string | null }, db: Db = defaultPrisma) {
  const s = await db.treatmentSession.findUnique({ where: { id: sessionId }, select: { recognizedAt: true, recognizedReversedAt: true } });
  if (!s?.recognizedAt) return { reversed: false, reason: "not-recognized" as const };
  if (s.recognizedReversedAt) return { reversed: false, reason: "already-reversed" as const };
  await db.treatmentSession.update({
    where: { id: sessionId },
    data: { recognizedReversedAt: new Date(), recognizedReversalReason: opts.reason, recognizedReversedBy: opts.by ?? null },
  });
  return { reversed: true as const };
}

/** Tổng doanh thu ghi nhận của 1 khách (loại buổi đã đảo). */
export async function recognizedRevenueForCustomer(customerId: string, db: Db = defaultPrisma): Promise<number> {
  const agg = await db.treatmentSession.aggregate({
    _sum: { recognizedRevenue: true },
    where: { customerId, recognizedReversedAt: null, recognizedRevenue: { not: null } },
  });
  return num(agg._sum.recognizedRevenue);
}
