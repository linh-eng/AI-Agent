// =============================================================================
// PRICING / COSTING — PH4: BookingItem price snapshot consistency. Test HTTP thật
// trên Postgres. Bao phủ A–W (PH4 §25): mỗi BookingItem snapshot giá theo CÙNG bối
// cảnh segment khách với Booking; immutability; total derived; legacy; RBAC; audit.
// =============================================================================
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";

const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }));
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (n: string) => { const v = jar.get(n); return v === undefined ? undefined : { name: n, value: v }; },
    set: (n: string, v: string) => { jar.set(n, v); },
    delete: (n: string) => { jar.delete(n); },
  }),
}));

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { resetDb, uniq } from "./helpers";
import { PERMISSIONS } from "@/lib/rbac";
import { POST as staffLogin } from "@/app/api/auth/login/route";
import { POST as bookingPostRaw } from "@/app/api/bookings/route";
import { GET as bookingGetRaw, PATCH as bookingPatchRaw } from "@/app/api/bookings/[id]/route";

const bookingPost = (body: unknown) => bookingPostRaw(new Request("http://t/api/bookings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), {} as any);
const bookingGet = (id: string) => bookingGetRaw(new Request("http://t/api/bookings/" + id), { params: { id } } as any);
const bookingPatch = (id: string, body: unknown) => bookingPatchRaw(new Request("http://t/api/bookings/" + id, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), { params: { id } } as any);

let ip = 0;
async function rj(res: Response) { const t = await res.text(); try { const j = t ? JSON.parse(t) : null; return j && "data" in j ? j.data : j; } catch { return null; } }
async function makeStaff(perms: string[]) {
  const email = `${uniq("bkp")}@thng.com.vn`.toLowerCase();
  const user = await prisma.user.create({ data: { email, name: "NV", passwordHash: await hashPassword("matkhau123") } });
  const role = await prisma.role.create({ data: { code: uniq("ROLE"), name: "R" } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  for (const c of perms) { const p = await prisma.permission.upsert({ where: { code: c }, update: {}, create: { code: c } }); await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: p.id } }); }
  return email;
}
async function login(email: string) {
  jar.clear();
  await staffLogin(new Request("http://t/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `10.34.0.${++ip}` }, body: JSON.stringify({ email, password: "matkhau123" }) }), {} as any);
}
async function asReception() { await login(await makeStaff([PERMISSIONS.BOOKING_WRITE, PERMISSIONS.BOOKING_READ, PERMISSIONS.CUSTOMER_READ, PERMISSIONS.TREATMENT_READ])); }

const AT = "2026-09-01T02:00:00.000Z";
async function svc(standard: number) { return prisma.service.create({ data: { code: uniq("DV"), name: uniq("S"), standardPrice: standard, durationMinutes: 30 } }); }
async function rule(serviceId: string, priceType: string, price: number) {
  return prisma.priceRule.create({ data: { targetType: "SERVICE", targetId: serviceId, priceType: priceType as any, price, isActive: true } });
}
async function customer(group: string | null) { return prisma.customer.create({ data: { code: uniq("KH"), fullName: "KH " + (group ?? "thường"), group } }); }

beforeAll(async () => { await resetDb(); });
beforeEach(async () => { await resetDb(); jar.clear(); });
afterAll(async () => { await prisma.$disconnect(); });

describe("PH4 · BookingItem price snapshot consistency", () => {
  it("A khách thường: item dùng STANDARD rule (resolver), KHÔNG lấy Service.standardPrice khi có rule", async () => {
    await asReception();
    const s = await svc(2_500_000); // standardPrice
    await rule(s.id, "STANDARD", 2_400_000); // STANDARD rule ≠ standardPrice
    const c = await customer(null);
    const b = await rj(await bookingPost({ customerId: c.id, scheduledAt: AT, items: [{ serviceId: s.id }] }));
    const items = await prisma.bookingItem.findMany({ where: { bookingId: b.id } });
    expect(Number(items[0].priceSnapshot)).toBe(2_400_000);
    expect(items[0].priceSource).toBe("PRICE_RULE");
    expect(items[0].priceTypeSnapshot).toBe("STANDARD");
  });

  it("B khách VIP: item dùng VIP rule (segment)", async () => {
    await asReception();
    const s = await svc(2_500_000);
    await rule(s.id, "STANDARD", 2_400_000); await rule(s.id, "VIP", 2_100_000);
    const c = await customer("VIP");
    const b = await rj(await bookingPost({ customerId: c.id, scheduledAt: AT, items: [{ serviceId: s.id }] }));
    const it = (await prisma.bookingItem.findMany({ where: { bookingId: b.id } }))[0];
    expect(Number(it.priceSnapshot)).toBe(2_100_000);
    expect(it.priceTypeSnapshot).toBe("VIP");
  });

  it("C+D+F 1 Booking 3 dịch vụ (VIP): mọi item cùng context VIP; total=Σ; Booking.price=item[0] (≠ tổng)", async () => {
    await asReception();
    const dmk = await svc(2_500_000), laser = await svc(1_800_000), rec = await svc(600_000);
    await rule(dmk.id, "STANDARD", 2_500_000); await rule(dmk.id, "VIP", 2_100_000);
    await rule(laser.id, "STANDARD", 1_800_000); await rule(laser.id, "VIP", 1_500_000);
    await rule(rec.id, "STANDARD", 600_000); await rule(rec.id, "VIP", 500_000);
    const c = await customer("VIP");
    const b = await rj(await bookingPost({ customerId: c.id, scheduledAt: AT, items: [{ serviceId: dmk.id }, { serviceId: laser.id }, { serviceId: rec.id }] }));
    const items = await prisma.bookingItem.findMany({ where: { bookingId: b.id }, orderBy: { sortOrder: "asc" } });
    expect(items.map((i) => Number(i.priceSnapshot))).toEqual([2_100_000, 1_500_000, 500_000]); // C
    expect(items.every((i) => i.priceTypeSnapshot === "VIP")).toBe(true);
    // D: total derived = Σ snapshot
    const d = await rj(await bookingGet(b.id));
    expect(d.itemsTotal).toBe(4_100_000);
    // F: Booking.price = giá dịch vụ CHÍNH (item[0]=DMK VIP), KHÔNG phải tổng
    expect(Number(b.price)).toBe(2_100_000);
    expect(Number(b.price)).not.toBe(4_100_000);
  });

  it("E không có rule khớp → fallback Service.standardPrice (STANDARD_FALLBACK)", async () => {
    await asReception();
    const s = await svc(1_234_000); // không tạo PriceRule
    const c = await customer(null);
    const b = await rj(await bookingPost({ customerId: c.id, scheduledAt: AT, items: [{ serviceId: s.id }] }));
    const it = (await prisma.bookingItem.findMany({ where: { bookingId: b.id } }))[0];
    expect(Number(it.priceSnapshot)).toBe(1_234_000);
    expect(it.priceSource).toBe("STANDARD_FALLBACK");
  });

  it("G+H+K PriceRule đổi sau → item cũ BẤT BIẾN; Booking mới lấy giá mới; GET không re-resolve", async () => {
    await asReception();
    const s = await svc(2_500_000);
    await rule(s.id, "STANDARD", 2_500_000); const vip = await rule(s.id, "VIP", 2_100_000);
    const c = await customer("VIP");
    const b1 = await rj(await bookingPost({ customerId: c.id, scheduledAt: AT, items: [{ serviceId: s.id }] }));
    // đổi VIP rule 2.1 → 2.3
    await prisma.priceRule.update({ where: { id: vip.id }, data: { price: 2_300_000 } });
    // G+K: item cũ vẫn 2.1 (GET không tính lại)
    const d1 = await rj(await bookingGet(b1.id));
    expect(Number(d1.items[0].priceSnapshot)).toBe(2_100_000);
    // H: booking mới = 2.3
    const b2 = await rj(await bookingPost({ customerId: c.id, scheduledAt: AT, items: [{ serviceId: s.id }] }));
    expect(Number((await prisma.bookingItem.findMany({ where: { bookingId: b2.id } }))[0].priceSnapshot)).toBe(2_300_000);
  });

  it("I add item sau: item cũ giữ giá (gửi lại priceSnapshot), item mới lấy giá hiện tại", async () => {
    await asReception();
    const dmk = await svc(2_500_000), laser = await svc(1_800_000);
    await rule(dmk.id, "VIP", 2_100_000); const laserVip = await rule(laser.id, "VIP", 1_500_000);
    const c = await customer("VIP");
    const b = await rj(await bookingPost({ customerId: c.id, scheduledAt: AT, items: [{ serviceId: dmk.id }] }));
    const dmkItem = (await prisma.bookingItem.findMany({ where: { bookingId: b.id } }))[0];
    // đổi giá laser VIP sau
    await prisma.priceRule.update({ where: { id: laserVip.id }, data: { price: 1_700_000 } });
    // PATCH: gửi lại DMK KÈM priceSnapshot cũ (giữ) + thêm laser (resolve mới)
    await bookingPatch(b.id, { items: [{ serviceId: dmk.id, priceSnapshot: Number(dmkItem.priceSnapshot) }, { serviceId: laser.id }] });
    const items = await prisma.bookingItem.findMany({ where: { bookingId: b.id }, orderBy: { sortOrder: "asc" } });
    expect(Number(items[0].priceSnapshot)).toBe(2_100_000); // DMK giữ
    expect(Number(items[1].priceSnapshot)).toBe(1_700_000); // laser giá mới
  });

  it("J đổi service của item → resolve lại theo service mới", async () => {
    await asReception();
    const dmk = await svc(2_500_000), laser = await svc(1_800_000);
    await rule(dmk.id, "VIP", 2_100_000); await rule(laser.id, "VIP", 1_500_000);
    const c = await customer("VIP");
    const b = await rj(await bookingPost({ customerId: c.id, scheduledAt: AT, items: [{ serviceId: dmk.id }] }));
    await bookingPatch(b.id, { items: [{ serviceId: laser.id }] }); // đổi sang laser (không priceSnapshot)
    const it = (await prisma.bookingItem.findMany({ where: { bookingId: b.id } }))[0];
    expect(it.serviceId).toBe(laser.id);
    expect(Number(it.priceSnapshot)).toBe(1_500_000);
  });

  it("L+M legacy booking (không item) → dual-read dùng Booking.price, không re-resolve", async () => {
    await asReception();
    const s = await svc(2_500_000);
    await rule(s.id, "VIP", 2_100_000);
    const c = await customer("VIP");
    // tạo booking legacy trực tiếp: có serviceId + price cũ, KHÔNG có BookingItem
    const legacy = await prisma.booking.create({ data: { code: uniq("BK"), customerId: c.id, serviceId: s.id, scheduledAt: new Date(AT), price: 999_000, durationMinutes: 30 } });
    const d = await rj(await bookingGet(legacy.id));
    expect(d.items.length).toBe(1);
    expect(d.items[0].legacy).toBe(true);
    expect(Number(d.items[0].priceSnapshot)).toBe(999_000); // = Booking.price, KHÔNG resolve 2.1
    expect(await prisma.bookingItem.count({ where: { bookingId: legacy.id } })).toBe(0); // không ghi DB
  });

  it("N PriceRule precedence không đổi: VIP > STANDARD (cùng resolver)", async () => {
    const { resolvePrice } = await import("@/lib/pricing");
    const s = await svc(2_500_000);
    await rule(s.id, "STANDARD", 2_400_000); await rule(s.id, "VIP", 2_100_000);
    const vip = await resolvePrice("SERVICE", s.id, { types: ["STANDARD", "VIP"] });
    expect(vip?.priceType).toBe("VIP");
    const std = await resolvePrice("SERVICE", s.id, { types: ["STANDARD"] });
    expect(std?.priceType).toBe("STANDARD");
  });

  it("P RecommendedPrice KHÔNG dùng làm fallback bán: item = standardPrice, không phải recommended", async () => {
    await asReception();
    const { createCostingVersion, publishCostingVersion } = await import("@/lib/service-costing");
    const { createRecommendedVersion, publishRecommendedVersion } = await import("@/lib/recommended-price");
    const s = await svc(1_000_000); // standardPrice thấp, KHÔNG có PriceRule
    const { version: cv } = await createCostingVersion({ serviceId: s.id, equipmentCost: 900_000 });
    const { version: cpub } = await publishCostingVersion(cv.id, "x");
    const rec = await createRecommendedVersion({ serviceId: s.id, serviceCostingVersionId: cpub.id, targetMarginPercent: 50 }); // = 1,800,000
    await publishRecommendedVersion(rec.id, "x");
    const c = await customer(null);
    const b = await rj(await bookingPost({ customerId: c.id, scheduledAt: AT, items: [{ serviceId: s.id }] }));
    const it = (await prisma.bookingItem.findMany({ where: { bookingId: b.id } }))[0];
    expect(Number(it.priceSnapshot)).toBe(1_000_000); // standardPrice, KHÔNG phải recommended 1.8M
  });

  it("T+U RBAC + audit: ẩn danh→401; thiếu booking.write→403; BOOKING_ITEM_PRICE_SNAPSHOTTED ghi", async () => {
    const s = await svc(2_000_000); const c = await customer(null);
    jar.clear();
    expect((await bookingPost({ customerId: c.id, scheduledAt: AT, items: [{ serviceId: s.id }] })).status).toBe(401);
    await login(await makeStaff([PERMISSIONS.BOOKING_READ]));
    expect((await bookingPost({ customerId: c.id, scheduledAt: AT, items: [{ serviceId: s.id }] })).status).toBe(403);
    // audit
    await asReception();
    const b = await rj(await bookingPost({ customerId: c.id, scheduledAt: AT, items: [{ serviceId: s.id }] }));
    const actions = (await prisma.auditLog.findMany({ where: { entityId: b.id }, select: { action: true } })).map((a) => a.action);
    expect(actions).toContain("BOOKING_ITEM_PRICE_SNAPSHOTTED");
  });
});
