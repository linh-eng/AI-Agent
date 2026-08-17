// =============================================================================
// Redesign P3 — 1 Booking chứa NHIỀU dịch vụ (BookingItem). Nghiệm thu HTTP thật:
//   A. Legacy Booking 1 Service vẫn PASS (dual-read → 1 item ảo).
//   B. New Booking 1 → 3 BookingItem (đúng sortOrder) + DB persistence.
//   D. Reorder persistence (PATCH items).
//   E. Add/remove item.
//   F. totalDuration = Σ durationSnapshot.
//   G. Đổi Service.duration sau → BookingItem.durationSnapshot KHÔNG đổi.
//   H. Unauthorized → 401/403.
//   I. Calendar: list trả 1 booking (1 card) kèm items.
//   J. Backfill idempotent — không duplicate item.
// =============================================================================
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }));
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (n: string) => { const v = jar.get(n); return v === undefined ? undefined : { name: n, value: v }; },
    set: (n: string, v: string) => { jar.set(n, v); },
    delete: (n: string) => { jar.delete(n); },
  }),
}));

import { prisma } from "@/lib/prisma";
import { hashPassword, SESSION_COOKIE } from "@/lib/auth";
import { resetDb, uniq } from "./helpers";
import { PERMISSIONS } from "@/lib/rbac";
import { backfillBookingItems } from "@/lib/booking-items";

import { POST as staffLogin } from "@/app/api/auth/login/route";
import { GET as bkList, POST as bkPost } from "@/app/api/bookings/route";
import { GET as bkGet, PATCH as bkPatch } from "@/app/api/bookings/[id]/route";

let ip = 0;
function jreq(url: string, method: string, body?: unknown) {
  return new Request(url, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
}
async function rj(res: Response) { const t = await res.text(); try { return t ? JSON.parse(t) : null; } catch { return null; } }
async function makeStaff(perms: string[]) {
  const email = `${uniq("s")}@thng.com.vn`.toLowerCase();
  const user = await prisma.user.create({ data: { email, name: uniq("NV"), passwordHash: await hashPassword("matkhau123") } });
  const role = await prisma.role.create({ data: { code: uniq("R"), name: "R" } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  for (const code of perms) {
    const p = await prisma.permission.upsert({ where: { code }, update: {}, create: { code } });
    await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: p.id } });
  }
  return { email, password: "matkhau123" };
}
async function login(email: string, password: string) {
  jar.clear();
  await staffLogin(new Request("http://t/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `10.11.0.${++ip}` }, body: JSON.stringify({ email, password }) }), {} as any);
  return jar.get(SESSION_COOKIE);
}
async function makeService(name: string, duration: number, price = 1_000_000) {
  return prisma.service.create({ data: { code: uniq("DV"), name, status: "ACTIVE", durationMinutes: duration, standardPrice: price, version: 1 } });
}

let writer: { email: string; password: string };
let reader: { email: string; password: string };
let cust: any, dmk: any, laser: any, recovery: any;

beforeAll(async () => {
  await resetDb();
  writer = await makeStaff([PERMISSIONS.BOOKING_READ, PERMISSIONS.BOOKING_WRITE, PERMISSIONS.SERVICE_READ]);
  reader = await makeStaff([PERMISSIONS.BOOKING_READ]); // KHÔNG có booking.write
  cust = await prisma.customer.create({ data: { code: uniq("KH"), fullName: "Khách P3" } });
  dmk = await makeService("DMK Enzyme Treatment", 83);
  laser = await makeService("Laser Pico", 30);
  recovery = await makeService("Recovery", 15);
});
beforeEach(() => { jar.clear(); });

describe("Redesign P3 · Booking nhiều dịch vụ (BookingItem)", () => {
  it("A · Legacy Booking 1 Service vẫn hoạt động (dual-read → 1 item ảo)", async () => {
    await login(writer.email, writer.password);
    const created = await rj(await bkPost(jreq("http://t/api/bookings", "POST", {
      customerId: cust.id, serviceId: dmk.id, scheduledAt: "2026-09-01T02:00:00.000Z",
    }), {} as any));
    expect(created.data.id).toBeTruthy();
    const id = created.data.id;
    // KHÔNG có BookingItem thật trong DB
    expect(await prisma.bookingItem.count({ where: { bookingId: id } })).toBe(0);
    // GET dual-read: 1 item ảo (legacy), serviceId đúng, durationSnapshot = service duration
    const got = await rj(await bkGet(jreq(`http://t/api/bookings/${id}`, "GET"), { params: { id } } as any));
    expect(got.data.items).toHaveLength(1);
    expect(got.data.items[0].serviceId).toBe(dmk.id);
    expect(got.data.items[0].legacy).toBe(true);
    expect(got.data.totalDuration).toBe(83);
  });

  it("B · New Booking: 1 Booking → 3 BookingItem đúng sortOrder + DB persistence", async () => {
    await login(writer.email, writer.password);
    const created = await rj(await bkPost(jreq("http://t/api/bookings", "POST", {
      customerId: cust.id, scheduledAt: "2026-09-02T02:00:00.000Z",
      items: [{ serviceId: dmk.id }, { serviceId: laser.id }, { serviceId: recovery.id }],
    }), {} as any));
    const id = created.data.id;
    // Booking.serviceId = item đầu (dịch vụ chính)
    expect(created.data.serviceId).toBe(dmk.id);
    // durationMinutes = tổng (83+30+15)
    expect(created.data.durationMinutes).toBe(128);
    // DB: đúng 3 item, sortOrder 0..2
    const rows = await prisma.bookingItem.findMany({ where: { bookingId: id }, orderBy: { sortOrder: "asc" } });
    expect(rows.map((r) => r.serviceId)).toEqual([dmk.id, laser.id, recovery.id]);
    expect(rows.map((r) => r.sortOrder)).toEqual([0, 1, 2]);
    // priceSnapshot ghi từ standardPrice
    expect(Number(rows[0].priceSnapshot)).toBe(1_000_000);
    // GET items + totalDuration
    const got = await rj(await bkGet(jreq(`http://t/api/bookings/${id}`, "GET"), { params: { id } } as any));
    expect(got.data.items.map((i: any) => i.service.name)).toEqual(["DMK Enzyme Treatment", "Laser Pico", "Recovery"]);
    expect(got.data.totalDuration).toBe(128);
  });

  it("D+E · Reorder + add/remove item (thay toàn bộ), persistence đúng", async () => {
    await login(writer.email, writer.password);
    const created = await rj(await bkPost(jreq("http://t/api/bookings", "POST", {
      customerId: cust.id, scheduledAt: "2026-09-03T02:00:00.000Z",
      items: [{ serviceId: dmk.id }, { serviceId: laser.id }],
    }), {} as any));
    const id = created.data.id;
    // reorder + thêm recovery: laser, dmk, recovery
    await bkPatch(jreq(`http://t/api/bookings/${id}`, "PATCH", {
      items: [{ serviceId: laser.id }, { serviceId: dmk.id }, { serviceId: recovery.id }],
    }), { params: { id } } as any);
    let got = await rj(await bkGet(jreq(`http://t/api/bookings/${id}`, "GET"), { params: { id } } as any));
    expect(got.data.items.map((i: any) => i.serviceId)).toEqual([laser.id, dmk.id, recovery.id]);
    expect(got.data.serviceId).toBe(laser.id); // dịch vụ chính = item đầu mới
    expect(got.data.totalDuration).toBe(30 + 83 + 15);
    // remove xuống còn 1 (recovery)
    await bkPatch(jreq(`http://t/api/bookings/${id}`, "PATCH", { items: [{ serviceId: recovery.id }] }), { params: { id } } as any);
    got = await rj(await bkGet(jreq(`http://t/api/bookings/${id}`, "GET"), { params: { id } } as any));
    expect(got.data.items).toHaveLength(1);
    expect(got.data.items[0].serviceId).toBe(recovery.id);
    expect(await prisma.bookingItem.count({ where: { bookingId: id } })).toBe(1);
  });

  it("G · Đổi Service.duration sau → BookingItem.durationSnapshot KHÔNG đổi", async () => {
    await login(writer.email, writer.password);
    const created = await rj(await bkPost(jreq("http://t/api/bookings", "POST", {
      customerId: cust.id, scheduledAt: "2026-09-04T02:00:00.000Z", items: [{ serviceId: laser.id }],
    }), {} as any));
    const id = created.data.id;
    const before = await prisma.bookingItem.findFirst({ where: { bookingId: id } });
    expect(before!.durationSnapshot).toBe(30);
    // Đổi duration của Laser 30 → 45 (giả lập sửa Service)
    await prisma.service.update({ where: { id: laser.id }, data: { durationMinutes: 45 } });
    const after = await prisma.bookingItem.findFirst({ where: { bookingId: id } });
    expect(after!.durationSnapshot).toBe(30); // snapshot bất biến
    // khôi phục cho test khác
    await prisma.service.update({ where: { id: laser.id }, data: { durationMinutes: 30 } });
  });

  it("H · RBAC: thiếu booking.write → 403; ẩn danh → 401", async () => {
    await login(reader.email, reader.password);
    const res403 = await bkPost(jreq("http://t/api/bookings", "POST", { customerId: cust.id, scheduledAt: "2026-09-05T02:00:00.000Z", items: [{ serviceId: dmk.id }] }), {} as any);
    expect(res403.status).toBe(403);
    jar.clear();
    const res401 = await bkPost(jreq("http://t/api/bookings", "POST", { customerId: cust.id, scheduledAt: "2026-09-05T02:00:00.000Z" }), {} as any);
    expect(res401.status).toBe(401);
  });

  it("I · Calendar: list trả 1 booking (1 card) kèm items", async () => {
    await login(writer.email, writer.password);
    const created = await rj(await bkPost(jreq("http://t/api/bookings", "POST", {
      customerId: cust.id, scheduledAt: "2026-09-06T02:00:00.000Z",
      items: [{ serviceId: dmk.id }, { serviceId: laser.id }],
    }), {} as any));
    const list = await rj(await bkList(jreq("http://t/api/bookings?from=2026-09-06T00:00:00.000Z&to=2026-09-06T23:59:59.000Z", "GET"), {} as any));
    const rows = list.data.filter((b: any) => b.id === created.data.id);
    expect(rows).toHaveLength(1); // 1 booking = 1 card (KHÔNG tách thành 2)
    expect(rows[0].items).toHaveLength(2);
  });

  it("J · Backfill idempotent — legacy booking → 1 item, chạy 2 lần không duplicate", async () => {
    await login(writer.email, writer.password);
    const created = await rj(await bkPost(jreq("http://t/api/bookings", "POST", {
      customerId: cust.id, serviceId: dmk.id, scheduledAt: "2026-09-07T02:00:00.000Z",
    }), {} as any));
    const id = created.data.id;
    expect(await prisma.bookingItem.count({ where: { bookingId: id } })).toBe(0);
    const r1 = await backfillBookingItems(id);
    expect(r1.created).toBe(1);
    const r2 = await backfillBookingItems(id); // chạy lại
    expect(r2.created).toBe(0);
    expect(await prisma.bookingItem.count({ where: { bookingId: id } })).toBe(1);
    // validation: serviceId sai → 422
    const bad = await bkPost(jreq("http://t/api/bookings", "POST", { customerId: cust.id, scheduledAt: "2026-09-08T02:00:00.000Z", items: [{ serviceId: "khong-ton-tai" }] }), {} as any);
    expect(bad.status).toBe(422);
  });
});
