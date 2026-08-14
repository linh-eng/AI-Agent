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
import { parseVnLocal } from "@/lib/timezone";
import { PERMISSIONS, ROLE_PERMISSIONS } from "@/lib/rbac";
import { POST as staffLogin } from "@/app/api/auth/login/route";
import { POST as roleFeePost } from "@/app/api/employees/[id]/role-fees/route";
import { POST as sessionStaffPost } from "@/app/api/session-staff/route";

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
  // Dùng parseVnLocal → true-UTC, giờ VN (Asia/Ho_Chi_Minh) ổn định bất kể TZ tiến trình.
  const monday9 = parseVnLocal("2026-08-17T09:00");
  const monday10 = parseVnLocal("2026-08-17T10:00");

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
    await prisma.employeeLeave.create({ data: { employeeId: e.id, type: "ANNUAL", fromAt: parseVnLocal("2026-08-17T08:00"), toAt: parseVnLocal("2026-08-17T12:00") } });
    const av = await employeeAvailability(e.id, monday9, monday10);
    expect(av.onLeave).toBe(true);
    expect(av.available).toBe(false);
    // Sau 13:00 (ngoài khoảng nghỉ) → rảnh lại
    const av2 = await employeeAvailability(e.id, parseVnLocal("2026-08-17T13:30"), parseVnLocal("2026-08-17T14:30"));
    expect(av2.available).toBe(true);
  });

  it("trùng booking khác → bookingConflict", async () => {
    const e = await emp({ fullName: "KTV Busy", roles: ["Kỹ thuật viên"] });
    await prisma.employeeSchedule.create({ data: { employeeId: e.id, dayOfWeek: 1, startTime: "08:00", endTime: "17:00" } });
    const cust = await prisma.customer.create({ data: { code: uniq("KH"), fullName: "KH" } });
    await prisma.booking.create({ data: { code: uniq("BK"), customerId: cust.id, scheduledAt: parseVnLocal("2026-08-17T09:00"), durationMinutes: 60, technician: "KTV Busy", status: "CONFIRMED" } });
    const av = await employeeAvailability(e.id, parseVnLocal("2026-08-17T09:30"), parseVnLocal("2026-08-17T10:30"));
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

describe("Mục 8.4 — Biên hiệu lực phí (không chồng lấn) + snapshot theo NGÀY DỊCH VỤ + negative năng lực", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect(); });

  it("[#3] effectiveTo EXCLUSIVE: mốc 01/09 chỉ thuộc bản MỚI (không trả 2 giá)", async () => {
    const e = await emp({ fullName: "NV Biên" });
    await prisma.employeeRoleFee.createMany({ data: [
      { employeeId: e.id, role: "Kiểm tra", fee: 200_000, effectiveFrom: new Date("2023-01-10"), effectiveTo: new Date("2026-09-01") },
      { employeeId: e.id, role: "Kiểm tra", fee: 250_000, effectiveFrom: new Date("2026-09-01") },
    ] });
    expect(await resolveRoleFee(e.id, "Kiểm tra", new Date("2026-08-31"))).toBe(200_000); // trước mốc
    expect(await resolveRoleFee(e.id, "Kiểm tra", new Date("2026-09-01"))).toBe(250_000); // ĐÚNG mốc → bản mới
    expect(await resolveRoleFee(e.id, "Kiểm tra", new Date("2026-09-02"))).toBe(250_000);
    // currentRoleFees không nhân đôi vai trò ở đúng mốc
    const cur = await currentRoleFees(e.id, new Date("2026-09-01"));
    expect(cur.filter((r) => r.role === "Kiểm tra").length).toBe(1);
    expect(cur.find((r) => r.role === "Kiểm tra")?.fee).toBe(250_000);
  });

  it("[#1] snapshot phí Session theo NGÀY DỊCH VỤ: buổi 25/07 = 500k, buổi 03/09 = 600k", async () => {
    const e = await emp({ fullName: "Master SD" });
    await prisma.employeeRoleFee.createMany({ data: [
      { employeeId: e.id, role: "Master", fee: 500_000, effectiveFrom: new Date("2023-01-10"), effectiveTo: new Date("2026-09-01") },
      { employeeId: e.id, role: "Master", fee: 600_000, effectiveFrom: new Date("2026-09-01") },
    ] });
    const cust = await prisma.customer.create({ data: { code: uniq("KH"), fullName: "KH" } });
    const plan = await prisma.treatmentPlan.create({ data: { code: uniq("TP"), customerId: cust.id, name: "P" } });
    const old = await prisma.treatmentSession.create({ data: { planId: plan.id, customerId: cust.id, sessionNumber: 1, name: "Cũ", performedAt: new Date("2026-07-25T02:00:00Z") } });
    const neu = await prisma.treatmentSession.create({ data: { planId: plan.id, customerId: cust.id, sessionNumber: 3, name: "Mới", performedAt: new Date("2026-09-03T02:00:00Z") } });

    const mgr = await makeStaff([PERMISSIONS.TREATMENT_WRITE]);
    await login(mgr.email, mgr.password);
    const r1 = await sessionStaffPost(jsonReq("http://t", "POST", { sessionId: old.id, employeeId: e.id, staffName: "Master SD", role: "MASTER" }), {});
    const r2 = await sessionStaffPost(jsonReq("http://t", "POST", { sessionId: neu.id, employeeId: e.id, staffName: "Master SD", role: "MASTER" }), {});
    expect(r1.status).toBe(201); expect(r2.status).toBe(201);
    const ssOld = await prisma.sessionStaff.findFirstOrThrow({ where: { sessionId: old.id } });
    const ssNew = await prisma.sessionStaff.findFirstOrThrow({ where: { sessionId: neu.id } });
    expect(Number(ssOld.fee)).toBe(500_000); // buổi 25/07 → biểu phí cũ
    expect(Number(ssNew.fee)).toBe(600_000); // buổi 03/09 → biểu phí mới

    // Bất biến: đổi phí Master sau này KHÔNG đổi buổi cũ
    await prisma.employeeRoleFee.updateMany({ where: { employeeId: e.id, role: "Master", effectiveTo: null }, data: { effectiveTo: new Date("2026-10-01") } });
    await prisma.employeeRoleFee.create({ data: { employeeId: e.id, role: "Master", fee: 900_000, effectiveFrom: new Date("2026-10-01") } });
    expect(Number((await prisma.sessionStaff.findFirstOrThrow({ where: { sessionId: neu.id } })).fee)).toBe(600_000);
  });

  it("[#2] NEGATIVE năng lực: nhân sự khai báo KHÁC HIFU → KHÔNG được gợi ý cho dịch vụ HIFU", async () => {
    const hifu = await prisma.service.create({ data: { code: uniq("DV"), name: "HIFU", standardPrice: 6_000_000 } });
    const rf = await prisma.service.create({ data: { code: uniq("DV"), name: "RF", standardPrice: 1_800_000 } });
    const at = parseVnLocal("2026-08-24T13:00"); // Thứ 2
    const noHifu = await emp({ fullName: "Chỉ RF " + uniq("n"), roles: ["Kỹ thuật viên"] });
    await prisma.employeeSchedule.create({ data: { employeeId: noHifu.id, dayOfWeek: 1, startTime: "08:00", endTime: "17:00" } });
    await prisma.employeeCompetence.create({ data: { employeeId: noHifu.id, kind: "SERVICE", refId: rf.id, name: "RF" } });

    const forHifu = await suggestEmployeesForBooking({ serviceId: hifu.id, at, durationMinutes: 60 });
    expect(forHifu.some((x) => x.id === noHifu.id)).toBe(false); // KHÔNG gợi ý cho HIFU
    const forRf = await suggestEmployeesForBooking({ serviceId: rf.id, at, durationMinutes: 60 });
    expect(forRf.some((x) => x.id === noHifu.id)).toBe(true); // nhưng ĐƯỢC gợi ý cho RF (đúng năng lực)
  });
});
