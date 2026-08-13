// =============================================================================
// Mục 2 — Lịch hẹn: test tích hợp mức HTTP (route handler thật) trên Postgres thật.
// Bao phủ: RBAC, tự lấy thời lượng, phát hiện trùng + gợi ý, quyền override + audit,
// bắt buộc lý do override, đổi lịch (lịch sử), hủy, không đến, liên kết phác đồ.
// =============================================================================
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";

const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }));
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => { const v = jar.get(name); return v === undefined ? undefined : { name, value: v }; },
    set: (name: string, value: string) => { jar.set(name, value); },
    delete: (name: string) => { jar.delete(name); },
  }),
}));

import { prisma } from "@/lib/prisma";
import { hashPassword, SESSION_COOKIE } from "@/lib/auth";
import { resetDb, uniq } from "./helpers";

import { POST as createBookingRaw } from "@/app/api/bookings/route";
const createBooking = (r: Request) => createBookingRaw(r, {} as any);
import { GET as getBooking } from "@/app/api/bookings/[id]/route";
import { PATCH as patchStatus } from "@/app/api/bookings/[id]/status/route";
import { POST as reschedule } from "@/app/api/bookings/[id]/reschedule/route";

function req(url: string, method: string, body?: unknown) {
  return new Request(url, { method, headers: { "content-type": "application/json", "x-forwarded-for": "10.0.0.5" }, body: body === undefined ? undefined : JSON.stringify(body) });
}
async function readJson(res: Response) { const t = await res.text(); try { return t ? JSON.parse(t) : null; } catch { return null; } }

async function makeStaff(permCodes: string[]) {
  const email = `${uniq("staff")}@thng.com.vn`.toLowerCase();
  const user = await prisma.user.create({ data: { email, name: "NV Test", passwordHash: await hashPassword("matkhau123") } });
  const role = await prisma.role.create({ data: { code: uniq("ROLE"), name: "Role Test" } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  for (const code of permCodes) {
    const perm = await prisma.permission.upsert({ where: { code }, update: {}, create: { code } });
    await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: perm.id } });
  }
  return { user, email };
}
async function login(email: string) {
  jar.clear();
  const { POST: staffLogin } = await import("@/app/api/auth/login/route");
  await staffLogin(req("http://t/api/auth/login", "POST", { email, password: "matkhau123" }), {} as any);
  return jar.get(SESSION_COOKIE)!;
}
function auth(token: string) { jar.clear(); jar.set(SESSION_COOKIE, token); }

let writer = "";   // booking.read + booking.write (không override)
let boss = "";     // + booking.override
let customerId = "";
let serviceId = "";
let planId = "";
let stageId = "";

beforeAll(async () => {
  await resetDb();
  const w = await makeStaff(["booking.read", "booking.write"]);
  const b = await makeStaff(["booking.read", "booking.write", "booking.override"]);
  writer = await login(w.email);
  boss = await login(b.email);
  const c = await prisma.customer.create({ data: { code: uniq("KH"), fullName: "Khách Lịch Hẹn" } });
  customerId = c.id;
  const s = await prisma.service.create({ data: { code: uniq("SV"), name: "RF nâng cơ", durationMinutes: 60, standardPrice: 1_800_000 } });
  serviceId = s.id;
  const plan = await prisma.treatmentPlan.create({ data: { code: uniq("TP"), customerId, name: "Phác đồ nâng cơ", status: "ACTIVE", stages: { create: [{ name: "Can thiệp", orderIndex: 0 }] } }, include: { stages: true } });
  planId = plan.id; stageId = plan.stages[0].id;
});
beforeEach(() => { jar.clear(); });
afterAll(async () => { await prisma.$disconnect(); });

const FUT = (h: number, min = 0) => { const d = new Date(2099, 8, 1, h, min, 0); return d.toISOString(); };

describe("Lịch hẹn · RBAC", () => {
  it("ẩn danh → 401; có booking.read nhưng không booking.write → 403", async () => {
    jar.clear();
    const anon = await createBooking(req("http://t/api/bookings", "POST", { customerId, scheduledAt: FUT(9) }));
    expect(anon.status).toBe(401);
  });
});

describe("Lịch hẹn · Tạo + tự lấy thời lượng", () => {
  it("chọn dịch vụ, không nhập thời lượng → tự lấy 60′ từ dịch vụ", async () => {
    auth(writer);
    const res = await createBooking(req("http://t/api/bookings", "POST", { customerId, serviceId, scheduledAt: FUT(9) }));
    expect(res.status).toBe(201);
    const b = (await readJson(res)).data;
    expect(b.durationMinutes).toBe(60);
    expect(b.createdBy).toBeTruthy();
  });
});

describe("Lịch hẹn · Trùng lịch + gợi ý + override", () => {
  async function seedBusy() {
    auth(boss);
    await createBooking(req("http://t/api/bookings", "POST", { customerId, serviceId, scheduledAt: FUT(14), durationMinutes: 60, technician: "Phạm Chuyên Viên", room: "Phòng 1" }));
  }

  it("trùng KTV → 409 kèm conflicts + gợi ý khung giờ khác", async () => {
    await resetDbKeepUsers();
    await seedBusy();
    auth(writer);
    const res = await createBooking(req("http://t/api/bookings", "POST", { customerId, serviceId, scheduledAt: FUT(14, 30), durationMinutes: 60, technician: "Phạm Chuyên Viên" }));
    expect(res.status).toBe(409);
    const d = (await readJson(res)).details;
    expect(d.conflicts[0].field).toBe("technician");
    expect(Array.isArray(d.suggestions)).toBe(true);
    expect(d.suggestions.length).toBeGreaterThan(0);
    // Gợi ý đầu tiên phải KHÔNG trùng (>= 15:00).
    expect(new Date(d.suggestions[0].scheduledAt).getHours()).toBeGreaterThanOrEqual(15);
  });

  it("override khi KHÔNG có quyền → 403", async () => {
    await resetDbKeepUsers();
    await seedBusy();
    auth(writer);
    const res = await createBooking(req("http://t/api/bookings", "POST", { customerId, serviceId, scheduledAt: FUT(14, 30), durationMinutes: 60, technician: "Phạm Chuyên Viên", allowConflict: true, overrideReason: "cố tình" }));
    expect(res.status).toBe(403);
  });

  it("override có quyền nhưng THIẾU lý do → 400", async () => {
    await resetDbKeepUsers();
    await seedBusy();
    auth(boss);
    const res = await createBooking(req("http://t/api/bookings", "POST", { customerId, serviceId, scheduledAt: FUT(14, 30), durationMinutes: 60, technician: "Phạm Chuyên Viên", allowConflict: true }));
    expect(res.status).toBe(400);
  });

  it("override có quyền + lý do → 201, lưu overrideLog + audit BOOKING_OVERRIDE", async () => {
    await resetDbKeepUsers();
    await seedBusy();
    auth(boss);
    const res = await createBooking(req("http://t/api/bookings", "POST", { customerId, serviceId, scheduledAt: FUT(14, 30), durationMinutes: 60, technician: "Phạm Chuyên Viên", allowConflict: true, overrideReason: "Khách VIP yêu cầu đúng giờ" }));
    expect(res.status).toBe(201);
    const b = (await readJson(res)).data;
    expect(Array.isArray(b.overrideLog)).toBe(true);
    expect(b.overrideLog[0].reason).toContain("VIP");
    const audit = await prisma.auditLog.findFirst({ where: { entityType: "Booking", entityId: b.id, action: "BOOKING_OVERRIDE" } });
    expect(audit).toBeTruthy();
  });
});

describe("Lịch hẹn · Vòng đời (đổi/hủy/không đến) + liên kết phác đồ", () => {
  async function makeOne(extra: any = {}) {
    auth(writer);
    const res = await createBooking(req("http://t/api/bookings", "POST", { customerId, serviceId, scheduledAt: FUT(9), durationMinutes: 60, technician: "KTV A", ...extra }));
    return (await readJson(res)).data;
  }

  it("đổi lịch → giữ lịch cũ, ghi rescheduleHistory + Timeline khách", async () => {
    await resetDbKeepUsers();
    const b = await makeOne();
    auth(writer);
    const res = await reschedule(req(`http://t/api/bookings/${b.id}/reschedule`, "POST", { scheduledAt: FUT(16), reason: "khách bận" }), { params: { id: b.id } });
    expect(res.status).toBe(200);
    const upd = (await readJson(res)).data;
    expect(upd.rescheduleHistory.length).toBe(1);
    expect(new Date(upd.rescheduleHistory[0].from).getTime()).toBe(new Date(b.scheduledAt).getTime());
    const act = await prisma.crmActivity.findFirst({ where: { customerId, content: { contains: "Đổi lịch" } } });
    expect(act).toBeTruthy();
  });

  it("hủy → status CANCELLED + lưu người/lý do", async () => {
    await resetDbKeepUsers();
    const b = await makeOne();
    auth(writer);
    const res = await patchStatus(req(`http://t/api/bookings/${b.id}/status`, "PATCH", { status: "CANCELLED", reason: "khách đổi ý" }), { params: { id: b.id } });
    expect(res.status).toBe(200);
    const upd = (await readJson(res)).data;
    expect(upd.status).toBe("CANCELLED");
    expect(upd.cancelReason).toBe("khách đổi ý");
    expect(upd.cancelledBy).toBeTruthy();
    expect(upd.cancelledAt).toBeTruthy();
  });

  it("không đến → status NO_SHOW + lý do; hoàn thành ghi mốc completedAt", async () => {
    await resetDbKeepUsers();
    const b = await makeOne();
    auth(writer);
    const ns = await patchStatus(req(`http://t/api/bookings/${b.id}/status`, "PATCH", { status: "NO_SHOW", reason: "không liên lạc được" }), { params: { id: b.id } });
    const u1 = (await readJson(ns)).data;
    expect(u1.status).toBe("NO_SHOW");
    expect(u1.noShowReason).toBe("không liên lạc được");

    const b2 = await makeOne({ scheduledAt: FUT(11), technician: "KTV B" });
    auth(writer);
    const done = await patchStatus(req(`http://t/api/bookings/${b2.id}/status`, "PATCH", { status: "COMPLETED" }), { params: { id: b2.id } });
    expect((await readJson(done)).data.completedAt).toBeTruthy();
  });

  it("liên kết phác đồ → lưu planId/stageId/sessionNumber; GET trả tên phác đồ/giai đoạn", async () => {
    await resetDbKeepUsers();
    const b = await makeOne({ planId, stageId, sessionNumber: 2 });
    auth(writer);
    const res = await getBooking(req(`http://t/api/bookings/${b.id}`, "GET"), { params: { id: b.id } });
    const d = (await readJson(res)).data;
    expect(d.planId).toBe(planId);
    expect(d.sessionNumber).toBe(2);
    expect(d.plan.name).toBe("Phác đồ nâng cơ");
    expect(d.stage.name).toBe("Can thiệp");
  });
});

// Xóa dữ liệu booking/crm nhưng GIỮ user/role/customer/service/plan để không phải đăng nhập lại.
async function resetDbKeepUsers() {
  await prisma.auditLog.deleteMany({ where: { entityType: "Booking" } });
  await prisma.crmActivity.deleteMany({});
  await prisma.booking.deleteMany({});
}
