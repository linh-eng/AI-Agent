// =============================================================================
// D4 — DOANH THU GHI NHẬN (recognized revenue). Kiểm chứng:
//   * Resolver deterministic 6 case (complimentary / booking item / booking price /
//     package allocation / session price / unknown).
//   * Đông cứng khi COMPLETED (idempotent) + BẤT BIẾN (đổi giá sau KHÔNG đổi số ghi).
//   * Bút toán ĐẢO khi hủy sau ghi nhận (giữ số cũ, loại khỏi tổng).
//   * TÁCH khỏi tiền thực thu (cash = Payment/Deposit) — không đụng.
// =============================================================================
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resolveRecognizedRevenue, freezeRecognizedRevenue, reverseRecognizedRevenue, recognizedRevenueForCustomer } from "@/lib/recognized-revenue";
import { resetDb, uniq, makeCustomer } from "./helpers";

beforeAll(async () => { await resetDb(); });
beforeEach(async () => { await resetDb(); });
afterAll(async () => { await prisma.$disconnect().catch(() => {}); });

const mkService = (price: number) => prisma.service.create({ data: { code: uniq("DV"), name: "DV " + uniq("s"), standardPrice: price } });
const mkSession = (customerId: string, over: any = {}) => prisma.treatmentSession.create({ data: { customerId, sessionNumber: 1, ...over } });

describe("D4 — recognized revenue resolver + freeze + reverse", () => {
  it("A · COMPLIMENTARY: buổi tặng → 0 CÓ CHỦ ĐÍCH (khác null)", async () => {
    const c = await makeCustomer();
    const s = await mkSession(c.id, { isComplimentary: true, price: 500_000 });
    const r = await resolveRecognizedRevenue(s.id);
    expect(r.source).toBe("COMPLIMENTARY");
    expect(r.amount).toBe(0);
  });

  it("B · BOOKING_ITEM: lấy priceSnapshot của item khớp serviceId", async () => {
    const c = await makeCustomer();
    const svc = await mkService(999_000);
    const bk = await prisma.booking.create({ data: { code: uniq("BK"), customerId: c.id, scheduledAt: new Date(), serviceId: svc.id, price: 900_000 } });
    await prisma.bookingItem.create({ data: { bookingId: bk.id, serviceId: svc.id, sortOrder: 0, priceSnapshot: 850_000 } });
    const s = await mkSession(c.id, { bookingId: bk.id, serviceId: svc.id });
    const r = await resolveRecognizedRevenue(s.id);
    expect(r.source).toBe("BOOKING_ITEM");
    expect(r.amount).toBe(850_000);
  });

  it("C · BOOKING_PRICE: không có item → Booking.price", async () => {
    const c = await makeCustomer();
    const bk = await prisma.booking.create({ data: { code: uniq("BK"), customerId: c.id, scheduledAt: new Date(), price: 700_000 } });
    const s = await mkSession(c.id, { bookingId: bk.id });
    const r = await resolveRecognizedRevenue(s.id);
    expect(r.source).toBe("BOOKING_PRICE");
    expect(r.amount).toBe(700_000);
  });

  it("D · PACKAGE_ALLOCATION: chia ĐỀU giá gói (invoice) theo SỐ BUỔI", async () => {
    const c = await makeCustomer();
    const plan = await prisma.treatmentPlan.create({ data: { code: uniq("TP"), customerId: c.id, name: "Gói 4 buổi" } });
    await prisma.invoice.create({ data: { code: uniq("HD"), customerId: c.id, planId: plan.id, status: "UNPAID", subtotal: 8_000_000, total: 8_000_000 } });
    // 4 buổi trong phác đồ → mỗi buổi = 8.000.000 / 4 = 2.000.000
    const sessions = [];
    for (let i = 0; i < 4; i++) sessions.push(await mkSession(c.id, { planId: plan.id, sessionNumber: i + 1 }));
    const r = await resolveRecognizedRevenue(sessions[0].id);
    expect(r.source).toBe("PACKAGE_ALLOCATION");
    expect(r.amount).toBe(2_000_000);
    expect((r.snapshot as any).sessionCount).toBe(4);
  });

  it("E · SESSION_PRICE fallback / F · UNKNOWN", async () => {
    const c = await makeCustomer();
    const s1 = await mkSession(c.id, { price: 300_000 });
    expect((await resolveRecognizedRevenue(s1.id)).source).toBe("SESSION_PRICE");
    const s2 = await mkSession(c.id, {});
    const r2 = await resolveRecognizedRevenue(s2.id);
    expect(r2.source).toBe("UNKNOWN");
    expect(r2.amount).toBeNull();
  });

  it("G · freeze idempotent + BẤT BIẾN: đổi Booking.price sau KHÔNG đổi số đã ghi", async () => {
    const c = await makeCustomer();
    const bk = await prisma.booking.create({ data: { code: uniq("BK"), customerId: c.id, scheduledAt: new Date(), price: 700_000 } });
    const s = await mkSession(c.id, { bookingId: bk.id });
    const f1 = await freezeRecognizedRevenue(s.id);
    expect(f1.alreadyFrozen).toBe(false);
    expect(f1.amount).toBe(700_000);
    // freeze lần 2 → giữ nguyên (idempotent)
    const f2 = await freezeRecognizedRevenue(s.id);
    expect(f2.alreadyFrozen).toBe(true);
    expect(f2.amount).toBe(700_000);
    // đổi giá booking SAU khi ghi nhận → số đã đông cứng KHÔNG đổi
    await prisma.booking.update({ where: { id: bk.id }, data: { price: 5_000_000 } });
    const after = await prisma.treatmentSession.findUniqueOrThrow({ where: { id: s.id }, select: { recognizedRevenue: true } });
    expect(Number(after.recognizedRevenue)).toBe(700_000);
  });

  it("H · reverse: hủy sau ghi nhận → giữ số cũ + loại khỏi tổng; chặn đảo 2 lần", async () => {
    const c = await makeCustomer();
    const s = await mkSession(c.id, { price: 400_000 });
    await freezeRecognizedRevenue(s.id);
    expect(await recognizedRevenueForCustomer(c.id)).toBe(400_000);
    const rev = await reverseRecognizedRevenue(s.id, { reason: "Hoàn tiền" });
    expect(rev.reversed).toBe(true);
    // loại khỏi tổng
    expect(await recognizedRevenueForCustomer(c.id)).toBe(0);
    // số cũ vẫn còn (giữ vết)
    const row = await prisma.treatmentSession.findUniqueOrThrow({ where: { id: s.id }, select: { recognizedRevenue: true, recognizedReversedAt: true } });
    expect(Number(row.recognizedRevenue)).toBe(400_000);
    expect(row.recognizedReversedAt).not.toBeNull();
    // đảo lần 2 → no-op
    const rev2 = await reverseRecognizedRevenue(s.id, { reason: "x" });
    expect(rev2.reversed).toBe(false);
  });

  it("I · complimentary freeze = 0; KHÔNG đụng cash (Payment giữ nguyên)", async () => {
    const c = await makeCustomer();
    await prisma.payment.create({ data: { code: uniq("PT"), customerId: c.id, amount: 1_000_000, method: "CASH", paidAt: new Date() } });
    const s = await mkSession(c.id, { isComplimentary: true, price: 999_000 });
    const f = await freezeRecognizedRevenue(s.id);
    expect(f.amount).toBe(0);
    expect(await recognizedRevenueForCustomer(c.id)).toBe(0);
    // cash không đổi
    const pay = await prisma.payment.aggregate({ _sum: { amount: true }, where: { customerId: c.id, voidedAt: null } });
    expect(Number(pay._sum.amount)).toBe(1_000_000);
  });
});
