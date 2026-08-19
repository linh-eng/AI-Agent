// =============================================================================
// Booking linh hoạt — KHÔNG cần dịch vụ cố định + thời gian đến/hoàn thành +
// thời gian RIÊNG từng dịch vụ. Nghiệm thu HTTP thật trên Postgres:
//   A. Tạo booking KHÔNG dịch vụ (chỉ thời gian đến + dự kiến hoàn thành) → 200,
//      serviceId null, durationMinutes suy từ khoảng thời gian.
//   B. expectedEndAt được LƯU (đọc lại đúng).
//   C. durationMinutes thủ công vẫn ưu tiên hơn expectedEndAt.
//   D. Nhiều dịch vụ, mỗi dịch vụ có thời gian riêng (durationSnapshot) → item
//      lưu đúng phút riêng; tổng = Σ phút riêng (KHÔNG lấy thời lượng chuẩn).
//   E. PATCH set expectedEndAt → durationMinutes tính lại.
//   F. Booking-level durationMinutes (không service, không end) vẫn chạy như cũ.
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
import { hashPassword } from "@/lib/auth";
import { resetDb, uniq } from "./helpers";
import { PERMISSIONS } from "@/lib/rbac";

import { POST as staffLogin } from "@/app/api/auth/login/route";
import { POST as bkPost } from "@/app/api/bookings/route";
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
  await staffLogin(new Request("http://t/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `10.14.0.${++ip}` }, body: JSON.stringify({ email, password }) }), {} as any);
}
async function makeService(name: string, duration: number, price = 1_000_000) {
  return prisma.service.create({ data: { code: uniq("DV"), name, status: "ACTIVE", durationMinutes: duration, standardPrice: price, version: 1 } });
}

let writer: { email: string; password: string };
let cust: any, svcA: any, svcB: any;

beforeAll(async () => {
  await resetDb();
  writer = await makeStaff([PERMISSIONS.BOOKING_READ, PERMISSIONS.BOOKING_WRITE, PERMISSIONS.SERVICE_READ]);
  cust = await prisma.customer.create({ data: { code: uniq("KH"), fullName: "Khách linh hoạt" } });
  svcA = await makeService("Dịch vụ A", 60);
  svcB = await makeService("Dịch vụ B", 45);
});
beforeEach(() => { jar.clear(); });

describe("Booking linh hoạt · không cần dịch vụ cố định + thời gian riêng dịch vụ", () => {
  it("A · tạo booking KHÔNG dịch vụ (chỉ đến + dự kiến hoàn thành) → serviceId null, duration suy từ thời gian", async () => {
    await login(writer.email, writer.password);
    const res = await bkPost(jreq("http://t/api/bookings", "POST", {
      customerId: cust.id,
      scheduledAt: "2026-09-10T02:00:00.000Z",
      expectedEndAt: "2026-09-10T03:30:00.000Z", // +90 phút
      note: "Khách đến tư vấn, chưa chốt dịch vụ",
    }), {} as any);
    expect(res.status).toBe(201);
    const created = (await rj(res)).data;
    expect(created.id).toBeTruthy();
    expect(created.serviceId).toBeNull();
    expect(created.durationMinutes).toBe(90); // 90 phút suy từ khoảng đến→hoàn thành
    // KHÔNG có BookingItem
    expect(await prisma.bookingItem.count({ where: { bookingId: created.id } })).toBe(0);
  });

  it("B · expectedEndAt được LƯU & đọc lại đúng", async () => {
    await login(writer.email, writer.password);
    const created = (await rj(await bkPost(jreq("http://t/api/bookings", "POST", {
      customerId: cust.id, scheduledAt: "2026-09-11T01:00:00.000Z", expectedEndAt: "2026-09-11T02:00:00.000Z",
    }), {} as any))).data;
    const row = await prisma.booking.findUnique({ where: { id: created.id } });
    expect(row!.expectedEndAt?.toISOString()).toBe("2026-09-11T02:00:00.000Z");
    const got = (await rj(await bkGet(jreq(`http://t/api/bookings/${created.id}`, "GET"), { params: { id: created.id } } as any))).data;
    expect(new Date(got.expectedEndAt).toISOString()).toBe("2026-09-11T02:00:00.000Z");
  });

  it("C · durationMinutes thủ công ưu tiên hơn expectedEndAt", async () => {
    await login(writer.email, writer.password);
    const created = (await rj(await bkPost(jreq("http://t/api/bookings", "POST", {
      customerId: cust.id, scheduledAt: "2026-09-12T02:00:00.000Z",
      expectedEndAt: "2026-09-12T04:00:00.000Z", // +120 nhưng...
      durationMinutes: 30, // ...thủ công thắng
    }), {} as any))).data;
    expect(created.durationMinutes).toBe(30);
  });

  it("D · nhiều dịch vụ, mỗi dịch vụ có thời gian RIÊNG (durationSnapshot) → lưu đúng, tổng = Σ phút riêng", async () => {
    await login(writer.email, writer.password);
    const created = (await rj(await bkPost(jreq("http://t/api/bookings", "POST", {
      customerId: cust.id, scheduledAt: "2026-09-13T02:00:00.000Z",
      // thời gian riêng KHÁC thời lượng chuẩn của dịch vụ (60/45) → chứng minh dùng phút nhập tay
      items: [{ serviceId: svcA.id, durationSnapshot: 20 }, { serviceId: svcB.id, durationSnapshot: 15 }],
    }), {} as any))).data;
    expect(created.serviceId).toBe(svcA.id); // dịch vụ chính = item đầu
    expect(created.durationMinutes).toBe(35); // 20 + 15 (KHÔNG phải 60+45)
    const rows = await prisma.bookingItem.findMany({ where: { bookingId: created.id }, orderBy: { sortOrder: "asc" } });
    expect(rows.map((r) => r.durationSnapshot)).toEqual([20, 15]);
  });

  it("E · PATCH set expectedEndAt → durationMinutes tính lại", async () => {
    await login(writer.email, writer.password);
    const created = (await rj(await bkPost(jreq("http://t/api/bookings", "POST", {
      customerId: cust.id, scheduledAt: "2026-09-14T02:00:00.000Z", durationMinutes: 60,
    }), {} as any))).data;
    const patched = (await rj(await bkPatch(jreq(`http://t/api/bookings/${created.id}`, "PATCH", {
      expectedEndAt: "2026-09-14T03:15:00.000Z", // +75 phút từ 02:00
    }), { params: { id: created.id } } as any))).data;
    const row = await prisma.booking.findUnique({ where: { id: created.id } });
    expect(row!.durationMinutes).toBe(75);
    expect(row!.expectedEndAt?.toISOString()).toBe("2026-09-14T03:15:00.000Z");
    expect(patched.id).toBe(created.id);
  });

  it("F · booking-level durationMinutes không service/không end vẫn chạy (tương thích cũ)", async () => {
    await login(writer.email, writer.password);
    const created = (await rj(await bkPost(jreq("http://t/api/bookings", "POST", {
      customerId: cust.id, scheduledAt: "2026-09-15T02:00:00.000Z", durationMinutes: 45,
    }), {} as any))).data;
    expect(created.serviceId).toBeNull();
    expect(created.durationMinutes).toBe(45);
    expect(created.expectedEndAt).toBeNull();
  });
});
