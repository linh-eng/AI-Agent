// =============================================================================
// Mục 8 — Nhân sự master data: đa vai trò, phí theo vai trò (hiệu lực ngày),
// snapshot phí, năng lực lọc gợi ý, loại trừ nghỉ việc/nghỉ phép/ngoài ca/trùng
// lịch, snapshot phí Session + Giá sàn, RBAC phí, audit đổi phí.
// =============================================================================
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";

const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }));
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (n: string) => { const v = jar.get(n); return v === undefined ? undefined : { name: n, value: v }; },
    set: (n: string, v: string) => { jar.set(n, v); }, delete: (n: string) => { jar.delete(n); },
  }),
}));

import { prisma } from "@/lib/prisma";
import { hashPassword, SESSION_COOKIE } from "@/lib/auth";
import { resetDb, uniq } from "./helpers";
import { resolveRoleFee, employeeAvailability, suggestEmployeesForBooking, currentRoleFees } from "@/lib/hr";
import { PERMISSIONS, ROLE_PERMISSIONS } from "@/lib/rbac";
import { POST as staffLogin } from "@/app/api/auth/login/route";
import { POST as roleFeePost } from "@/app/api/employees/[id]/role-fees/route";

function jsonReq(url: string, method: string, body?: unknown) {
  return new Request(url, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
}
async function readJson(res: Response) { const t = await res.text(); try { return t ? JSON.parse(t) : null; } catch { return null; } }
async function makeStaff(perms: string[]) {
  const email = `${uniq("s")}@thng.com.vn`.toLowerCase(); const password = "matkhau123";
  const user = await prisma.user.create({ data: { email, name: "NV " + uniq("n"), passwordHash: await hashPassword(password) } });
  const role = await prisma.role.create({ data: { code: uniq("R"), name: "R" } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  for (const c of perms) { const p = await prisma.permission.upsert({ where: { code: c }, update: {}, create: { code: c } }); await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: p.id } }); }
  return { email, password };
}
async function login(email: string, password: string) { jar.clear(); await staffLogin(jsonReq("http://t/api/auth/login", "POST", { email, password }), {}); return jar.get(SESSION_COOKIE); }

async function emp(over: Record<string, any> = {}) {
  return prisma.employee.create({ data: { code: uniq("NV"), fullName: "NV " + uniq("x"), status: "ACTIVE", ...over } });
}

describe("Mục 8.1 — Đa vai trò + phí theo vai trò + hiệu lực ngày", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect(); });

  it("một nhân sự giữ NHIỀU vai trò với phí KHÁC NHAU", async () => {
    const e = await emp({ fullName: "Phạm Chuyên Viên", roles: ["Kỹ thuật viên"] });
    await prisma.employeeRoleFee.createMany({ data: [
      { employeeId: e.id, role: "KTV chính", fee: 250_000, effectiveFrom: new Date("2024-01-01") },
      { employeeId: e.id, role: "Hỗ trợ", fee: 100_000, effectiveFrom: new Date("2024-01-01") },
    ] });
    const fees = await currentRoleFees(e.id);
    expect(fees.find((f) => f.role === "KTV chính")?.fee).toBe(250_000);
    expect(fees.find((f) => f.role === "Hỗ trợ")?.fee).toBe(100_000);
  });

  it("phí theo hiệu lực ngày: Master 500k đến 31/08, 600k từ 01/09", async () => {
    const e = await emp({ fullName: "Master A" });
    await prisma.employeeRoleFee.createMany({ data: [
      { employeeId: e.id, role: "Master", fee: 500_000, effectiveFrom: new Date("2023-01-01"), effectiveTo: new Date("2026-08-31T23:59:59Z") },
      { employeeId: e.id, role: "Master", fee: 600_000, effectiveFrom: new Date("2026-09-01") },
    ] });
    expect(await resolveRoleFee(e.id, "Master", new Date("2026-08-15"))).toBe(500_000);
    expect(await resolveRoleFee(e.id, "Master", new Date("2026-09-15"))).toBe(600_000);
  });

  it("đổi phí qua API = tạo bản mới + đóng bản cũ + AUDIT ghi cũ→mới (RBAC staff.fee.write)", async () => {
    const e = await emp({ fullName: "NV Fee" });
    await prisma.employeeRoleFee.create({ data: { employeeId: e.id, role: "KTV chính", fee: 250_000, effectiveFrom: new Date("2024-01-01") } });

    // Không có quyền → 403.
    const noPerm = await makeStaff(["staff.read"]);
    await login(noPerm.email, noPerm.password);
    const rDenied = await roleFeePost(jsonReq("http://t", "POST", { role: "KTV chính", fee: 300_000 }), { params: { id: e.id } });
    expect(rDenied.status).toBe(403);

    // Có quyền → tạo bản mới; bản cũ bị đóng hạn.
    const mgr = await makeStaff(["staff.fee.write"]);
    await login(mgr.email, mgr.password);
    const from = new Date("2026-06-01");
    const ok = await roleFeePost(jsonReq("http://t", "POST", { role: "KTV chính", fee: 300_000, effectiveFrom: from.toISOString() }), { params: { id: e.id } });
    expect(ok.status).toBe(201);

    expect(await resolveRoleFee(e.id, "KTV chính", new Date("2026-07-01"))).toBe(300_000);
    expect(await resolveRoleFee(e.id, "KTV chính", new Date("2024-06-01"))).toBe(250_000); // bản cũ vẫn tra được theo ngày cũ

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "STAFF_FEE_CHANGED", entityId: e.id } });
    expect((audit.changes as any).oldFee).toBe(250_000);
    expect((audit.changes as any).newFee).toBe(300_000);
    expect((audit.changes as any).role).toBe("KTV chính");
  });
});

describe("Mục 8.2 — Availability (khác isActive): ca làm / nghỉ phép / trùng lịch / năng lực", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect(); });

  // Chọn 1 ngày có thứ cố định để test lịch: 2026-08-17 là Thứ 2 (dayOfWeek=1).
  const monday9 = new Date("2026-08-17T09:00:00");
  const monday10 = new Date("2026-08-17T10:00:00");

  it("nghỉ việc (RESIGNED) → không available; không được gợi ý", async () => {
    const e = await emp({ status: "RESIGNED", roles: ["Kỹ thuật viên"] });
    const av = await employeeAvailability(e.id, monday9, monday10);
    expect(av.active).toBe(false);
    expect(av.available).toBe(false);
  });

  it("ngoài ca làm việc → không available (working=false)", async () => {
    const e = await emp({ roles: ["Kỹ thuật viên"] });
    await prisma.employeeSchedule.create({ data: { employeeId: e.id, dayOfWeek: 1, startTime: "13:00", endTime: "18:00" } }); // chỉ chiều
    const av = await employeeAvailability(e.id, monday9, monday10); // 9-10h sáng → ngoài ca
    expect(av.working).toBe(false);
    expect(av.available).toBe(false);
  });

  it("nghỉ phép trùng giờ → không available (onLeave)", async () => {
    const e = await emp({ roles: ["Kỹ thuật viên"] });
    await prisma.employeeSchedule.create({ data: { employeeId: e.id, dayOfWeek: 1, startTime: "08:00", endTime: "17:00" } });
    await prisma.employeeLeave.create({ data: { employeeId: e.id, type: "ANNUAL", fromAt: new Date("2026-08-17T08:00:00"), toAt: new Date("2026-08-17T12:00:00") } });
    const av = await employeeAvailability(e.id, monday9, monday10);
    expect(av.onLeave).toBe(true);
    expect(av.available).toBe(false);
    // Sau 13:00 (ngoài khoảng nghỉ) → rảnh lại
    const av2 = await employeeAvailability(e.id, new Date("2026-08-17T13:30:00"), new Date("2026-08-17T14:30:00"));
    expect(av2.available).toBe(true);
  });

  it("trùng booking khác → bookingConflict", async () => {
    const e = await emp({ fullName: "KTV Busy", roles: ["Kỹ thuật viên"] });
    await prisma.employeeSchedule.create({ data: { employeeId: e.id, dayOfWeek: 1, startTime: "08:00", endTime: "17:00" } });
    const cust = await prisma.customer.create({ data: { code: uniq("KH"), fullName: "KH" } });
    await prisma.booking.create({ data: { code: uniq("BK"), customerId: cust.id, scheduledAt: new Date("2026-08-17T09:00:00"), durationMinutes: 60, technician: "KTV Busy", status: "CONFIRMED" } });
    const av = await employeeAvailability(e.id, new Date("2026-08-17T09:30:00"), new Date("2026-08-17T10:30:00"));
    expect(av.bookingConflict).toBe(true);
    expect(av.available).toBe(false);
  });

  it("gợi ý cho booking: chỉ nhân sự ĐÚNG vai trò + CÓ năng lực + rảnh", async () => {
    const svc = await prisma.service.create({ data: { code: uniq("DV"), name: "HIFU", standardPrice: 6_000_000 } });
    // A: có vai trò + năng lực + ca làm → được gợi ý
    const a = await emp({ fullName: "NV A", roles: ["Kỹ thuật viên"] });
    await prisma.employeeSchedule.create({ data: { employeeId: a.id, dayOfWeek: 1, startTime: "08:00", endTime: "17:00" } });
    await prisma.employeeCompetence.create({ data: { employeeId: a.id, kind: "SERVICE", refId: svc.id, name: "HIFU" } });
    // B: có vai trò nhưng THIẾU năng lực HIFU → không gợi ý
    const b = await emp({ fullName: "NV B", roles: ["Kỹ thuật viên"] });
    await prisma.employeeSchedule.create({ data: { employeeId: b.id, dayOfWeek: 1, startTime: "08:00", endTime: "17:00" } });
    await prisma.employeeCompetence.create({ data: { employeeId: b.id, kind: "SERVICE", refId: "khac", name: "Facial" } });
    // C: nghỉ việc → không gợi ý
    await emp({ fullName: "NV C", status: "RESIGNED", roles: ["Kỹ thuật viên"] });

    const list = await suggestEmployeesForBooking({ role: "Kỹ thuật viên", serviceId: svc.id, at: monday9, durationMinutes: 60 });
    const names = list.map((x) => x.fullName);
    expect(names).toContain("NV A");
    expect(names).not.toContain("NV B"); // thiếu năng lực
    expect(names).not.toContain("NV C"); // nghỉ việc
  });
});

describe("Mục 8.3 — Snapshot phí Session + RBAC", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect(); });

  it("SessionStaff.fee là SNAPSHOT: đổi phí master sau KHÔNG đổi buổi cũ", async () => {
    const e = await emp({ fullName: "KTV S" });
    await prisma.employeeRoleFee.create({ data: { employeeId: e.id, role: "KTV chính", fee: 250_000, effectiveFrom: new Date("2024-01-01") } });
    const cust = await prisma.customer.create({ data: { code: uniq("KH"), fullName: "KH" } });
    const plan = await prisma.treatmentPlan.create({ data: { code: uniq("TP"), customerId: cust.id, name: "P" } });
    const sess = await prisma.treatmentSession.create({ data: { planId: plan.id, customerId: cust.id, sessionNumber: 1, name: "B1" } });
    // Snapshot phí lúc gán = 250k
    await prisma.sessionStaff.create({ data: { sessionId: sess.id, employeeId: e.id, staffName: e.fullName, role: "PRIMARY", fee: 250_000 } });
    // Đổi phí master → 300k
    await prisma.employeeRoleFee.updateMany({ where: { employeeId: e.id, role: "KTV chính" }, data: { effectiveTo: new Date("2026-01-01") } });
    await prisma.employeeRoleFee.create({ data: { employeeId: e.id, role: "KTV chính", fee: 300_000, effectiveFrom: new Date("2026-01-01") } });
    // Buổi cũ vẫn 250k
    const ss = await prisma.sessionStaff.findFirstOrThrow({ where: { sessionId: sess.id } });
    expect(Number(ss.fee)).toBe(250_000);
    // Phí hiện hành để gợi ý buổi MỚI = 300k
    expect(await resolveRoleFee(e.id, "KTV chính", new Date("2026-06-01"))).toBe(300_000);
  });

  it("RBAC: MANAGER có staff.fee.*; RECEPTION KHÔNG có fee; SPECIALIST không quản lý nhân sự", () => {
    expect(PERMISSIONS.STAFF_FEE_READ).toBe("staff.fee.read");
    expect(ROLE_PERMISSIONS.MANAGER).toContain(PERMISSIONS.STAFF_FEE_READ);
    expect(ROLE_PERMISSIONS.MANAGER).toContain(PERMISSIONS.STAFF_FEE_WRITE);
    expect(ROLE_PERMISSIONS.RECEPTION).toContain(PERMISSIONS.STAFF_WRITE);
    expect(ROLE_PERMISSIONS.RECEPTION).not.toContain(PERMISSIONS.STAFF_FEE_READ);
    expect(ROLE_PERMISSIONS.RECEPTION).not.toContain(PERMISSIONS.STAFF_FEE_WRITE);
    expect(ROLE_PERMISSIONS.SPECIALIST).not.toContain(PERMISSIONS.STAFF_WRITE);
  });
});
