// =============================================================================
// Redesign P3 — 1 Booking chứa NHIỀU dịch vụ (BookingItem). Tuần tự (sequential):
// tổng thời lượng = Σ durationSnapshot. Tài nguyên/nhân sự vẫn ở cấp Booking.
// Additive + tương thích ngược: Booking.serviceId GIỮ NGUYÊN (= item đầu = dịch vụ chính).
// =============================================================================
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolvePrice, priceTypesForCustomer } from "@/lib/pricing";

export const bookingItemInclude = {
  items: { orderBy: { sortOrder: "asc" }, include: { service: { select: { id: true, code: true, name: true, durationMinutes: true, standardPrice: true } } } },
} satisfies Prisma.BookingInclude;

export type BookingItemInput = {
  serviceId: string;
  durationSnapshot?: number | null;
  priceSnapshot?: number | null;
  plannedSessionId?: string | null;
  note?: string | null;
};

/**
 * Bối cảnh giá THỐNG NHẤT của một Booking (PH4): dùng CHUNG cho Booking.price và mọi
 * BookingItem — đảm bảo cùng khách/segment/thời điểm/chi nhánh → cùng kết quả giá.
 */
export interface BookingPricingContext {
  at?: Date | null;
  branch?: string | null;
  customerGroup?: string | null; // Customer.group → suy ra loại giá được hưởng
}

/**
 * Chuẩn hóa danh sách item + SNAPSHOT giá bán TẠI THỜI ĐIỂM tạo (PH4):
 *  - Nếu input có `priceSnapshot` (client gửi lại giá item CŨ) → GIỮ NGUYÊN (bất biến).
 *  - Ngược lại: `resolvePrice(SERVICE, serviceId, {at, branch, types})` theo cùng bối cảnh
 *    khách/segment với Booking; fallback Service.standardPrice khi không có PriceRule.
 *  - Ghi provenance: priceSource / priceRuleId / priceTypeSnapshot.
 * Đổi Service/PriceRule về sau KHÔNG đổi snapshot. `ctx` không truyền → fallback standard (tương thích cũ).
 */
export async function snapshotBookingItems(
  items: BookingItemInput[],
  ctx: BookingPricingContext = {},
  db: Pick<PrismaClient, "service"> = prisma,
): Promise<Prisma.BookingItemCreateWithoutBookingInput[]> {
  const ids = Array.from(new Set(items.map((i) => i.serviceId)));
  const svcs = ids.length ? await db.service.findMany({ where: { id: { in: ids } }, select: { id: true, durationMinutes: true, standardPrice: true } }) : [];
  const byId = new Map(svcs.map((s) => [s.id, s]));
  const at = ctx.at ?? undefined;
  const branch = ctx.branch ?? undefined;
  const types = priceTypesForCustomer(ctx.customerGroup);

  const out: Prisma.BookingItemCreateWithoutBookingInput[] = [];
  for (let idx = 0; idx < items.length; idx++) {
    const it = items[idx];
    const svc = byId.get(it.serviceId);
    let priceSnapshot: number | null;
    let priceSource: string | null;
    let priceRuleId: string | null = null;
    let priceTypeSnapshot: string | null = null;

    if (it.priceSnapshot != null) {
      // Item CŨ (client gửi lại giá đã snapshot) — giữ bất biến.
      priceSnapshot = Number(it.priceSnapshot);
      priceSource = "EXPLICIT";
    } else {
      const resolved = await resolvePrice("SERVICE", it.serviceId, { at, branch, types });
      if (resolved) {
        priceSnapshot = resolved.price; priceSource = "PRICE_RULE"; priceRuleId = resolved.ruleId; priceTypeSnapshot = resolved.priceType;
      } else {
        priceSnapshot = svc?.standardPrice != null ? Number(svc.standardPrice) : null;
        priceSource = "STANDARD_FALLBACK"; priceTypeSnapshot = "STANDARD";
      }
    }
    out.push({
      sortOrder: idx,
      service: { connect: { id: it.serviceId } },
      durationSnapshot: it.durationSnapshot ?? svc?.durationMinutes ?? null,
      priceSnapshot, priceSource, priceRuleId, priceTypeSnapshot,
      plannedSessionId: it.plannedSessionId ?? null,
      note: it.note ?? null,
    });
  }
  return out;
}

/** Tổng giá dịch vụ (derived) = Σ BookingItem.priceSnapshot (PH4 §5). KHÔNG ghi đè Booking.price. */
export function bookingItemsTotal(items: { priceSnapshot?: number | null | { toString(): string } }[] | undefined): number {
  return (items ?? []).reduce((s, i) => s + (i.priceSnapshot != null ? Number(i.priceSnapshot) : 0), 0);
}

/** Tổng thời lượng tuần tự = Σ durationSnapshot (bỏ qua null). */
export function totalItemsDuration(items: { durationSnapshot?: number | null }[] | undefined): number {
  return (items ?? []).reduce((s, i) => s + (i.durationSnapshot ?? 0), 0);
}

/** Kiểm tra tất cả serviceId tồn tại; trả về danh sách id thiếu (để báo 422). */
export async function missingServiceIds(ids: string[], db: Pick<PrismaClient, "service"> = prisma): Promise<string[]> {
  if (!ids.length) return [];
  const found = await db.service.findMany({ where: { id: { in: ids } }, select: { id: true } });
  const set = new Set(found.map((s) => s.id));
  return ids.filter((id) => !set.has(id));
}

/**
 * Backfill IDEMPOTENT cho booking legacy: nếu booking CHƯA có item nào và có serviceId,
 * tạo đúng 1 BookingItem tương ứng (snapshot từ Booking.durationMinutes/price nếu có).
 * Chạy lại KHÔNG tạo trùng (skip khi đã có item). KHÔNG heuristic — chỉ dựa serviceId thật.
 */
export async function backfillBookingItems(bookingId: string): Promise<{ created: number }> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, serviceId: true, durationMinutes: true, price: true, _count: { select: { items: true } } },
  });
  if (!booking || booking._count.items > 0 || !booking.serviceId) return { created: 0 };
  const svc = await prisma.service.findUnique({ where: { id: booking.serviceId }, select: { durationMinutes: true, standardPrice: true } });
  await prisma.bookingItem.create({
    data: {
      bookingId: booking.id,
      serviceId: booking.serviceId,
      sortOrder: 0,
      durationSnapshot: booking.durationMinutes ?? svc?.durationMinutes ?? null,
      priceSnapshot: booking.price ?? (svc?.standardPrice != null ? Number(svc.standardPrice) : null),
    },
  });
  return { created: 1 };
}

/**
 * Dual-read: trả về danh sách item để hiển thị. Nếu booking có item thật → dùng luôn.
 * Nếu KHÔNG có item nhưng có serviceId (legacy) → tổng hợp 1 item "ảo" (không ghi DB),
 * đánh dấu `legacy: true`. Nhờ vậy booking cũ vẫn hiển thị thống nhất mà không cần migrate.
 */
export function itemsForRead(booking: any): any[] {
  if (Array.isArray(booking.items) && booking.items.length > 0) return booking.items;
  if (booking.serviceId) {
    return [{
      id: `legacy:${booking.id}`, bookingId: booking.id, serviceId: booking.serviceId, sortOrder: 0,
      durationSnapshot: booking.durationMinutes ?? booking.service?.durationMinutes ?? null,
      priceSnapshot: booking.price ?? null,
      service: booking.service ? { id: booking.service.id, code: booking.service.code, name: booking.service.name } : undefined,
      legacy: true,
    }];
  }
  return [];
}
