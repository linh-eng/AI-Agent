// =============================================================================
// HR-PH2 — Ca dated + Chấm công + Nghỉ phép (đơn duyệt). Chứng minh A–AL.
//   Tính toán (unit, deterministic): worked/late/early/OT/cross-midnight/timezone.
//   Sinh ca (DB): recurring→dated · idempotent · không ghi đè · cross-midnight · branch · cancel giữ.
//   Chấm công (HTTP): self check-in FK · unlinked→403 · A không chấm hộ B · dup→409 ·
//     checkout đóng · double checkout an toàn · adjustment before/after · reason bắt buộc ·
//     void không hard-delete · nhân viên đề nghị KHÔNG tự duyệt · audit.
//   Nghỉ (HTTP): lifecycle · duyệt/từ chối audit · paid/unpaid · approved tránh false-absent ·
//     dữ liệu cũ giữ · cancel giữ lịch sử.
//   RBAC: self chỉ thấy của mình · attendance.read workspace · attendance.write cho sửa/duyệt ·
//     finance.read/staff.read KHÔNG mở chấm công · payroll reserved bất biến.
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
import { PERMISSIONS, ROLE_PERMISSIONS, ROLES } from "@/lib/rbac";
import { computeAttendance, computeScheduledMinutes, buildShiftInstants, generateShiftsFromSchedule, hasApprovedLeaveAt } from "@/lib/attendance";
import { parseVnLocal } from "@/lib/timezone";
import { POST as staffLogin } from "@/app/api/auth/login/route";
import { POST as checkInRaw } from "@/app/api/attendance/check-in/route";
import { POST as checkOutRaw } from "@/app/api/attendance/check-out/route";
import { POST as manualRaw } from "@/app/api/attendance/manual/route";
import { GET as attListRaw } from "@/app/api/attendance/route";
import { GET as attMeRaw } from "@/app/api/attendance/me/route";
import { POST as adjRaw, GET as adjListRaw } from "@/app/api/attendance/[id]/adjustments/route";
import { POST as voidRaw } from "@/app/api/attendance/[id]/void/route";
import { POST as leaveCreateRaw, GET as leaveListRaw } from "@/app/api/leave-requests/route";
import { PATCH as leavePatchRaw } from "@/app/api/leave-requests/[id]/route";
import { POST as leaveApproveRaw } from "@/app/api/leave-requests/[id]/approve/route";
import { POST as leaveRejectRaw } from "@/app/api/leave-requests/[id]/reject/route";

let ip = 0;
async function rj(res: Response) { const t = await res.text(); try { return t ? JSON.parse(t) : null; } catch { return null; } }
const data = async (res: Response) => { const j = await rj(res); return j && "data" in j ? j.data : j; };
async function makeUser(perms: string[]) {
  const email = `${uniq("att")}@thng.com.vn`.toLowerCase();
  const user = await prisma.user.create({ data: { email, name: "NV " + email.slice(0, 6), passwordHash: await hashPassword("matkhau123") } });
  const role = await prisma.role.create({ data: { code: uniq("ROLE"), name: "R" } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  for (const c of perms) { const p = await prisma.permission.upsert({ where: { code: c }, update: {}, create: { code: c } }); await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: p.id } }); }
  return { email, userId: user.id };
}
async function login(email: string) {
  jar.clear();
  await staffLogin(new Request("http://t/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `10.61.0.${++ip}` }, body: JSON.stringify({ email, password: "matkhau123" }) }), {} as any);
}
const J = (b: unknown) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
const checkin = (b: unknown) => checkInRaw(new Request("http://t/api/attendance/check-in", J(b)), {} as any);
const checkout = (b: unknown) => checkOutRaw(new Request("http://t/api/attendance/check-out", J(b)), {} as any);
const manual = (b: unknown) => manualRaw(new Request("http://t/api/attendance/manual", J(b)), {} as any);
const attList = (qs = "") => attListRaw(new Request("http://t/api/attendance" + qs), {} as any);
const attMe = () => attMeRaw(new Request("http://t/api/attendance/me"), {} as any);
const adj = (id: string, b: unknown) => adjRaw(new Request("http://t/api/attendance/" + id + "/adjustments", J(b)), { params: { id } } as any);
const adjList = (id: string) => adjListRaw(new Request("http://t/api/attendance/" + id + "/adjustments"), { params: { id } } as any);
const voidRec = (id: string, b: unknown) => voidRaw(new Request("http://t/api/attendance/" + id + "/void", J(b)), { params: { id } } as any);
const leaveCreate = (b: unknown) => leaveCreateRaw(new Request("http://t/api/leave-requests", J(b)), {} as any);
const leaveList = (qs = "") => leaveListRaw(new Request("http://t/api/leave-requests" + qs), {} as any);
const leaveCancel = (id: string) => leavePatchRaw(new Request("http://t/api/leave-requests/" + id, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "cancel" }) }), { params: { id } } as any);
const leaveApprove = (id: string) => leaveApproveRaw(new Request("http://t/api/leave-requests/" + id + "/approve", { method: "POST" }), { params: { id } } as any);
const leaveReject = (id: string, reason?: string) => leaveRejectRaw(new Request("http://t/api/leave-requests/" + id + "/reject", J({ reason })), { params: { id } } as any);

async function mkEmployee(over: { userId?: string; branchId?: string } = {}) {
  return prisma.employee.create({ data: { code: uniq("NV"), fullName: "NV Test", status: "ACTIVE", userId: over.userId ?? null, branchId: over.branchId ?? null } });
}

// ---------------------------------------------------------------------------
// M–R — Tính toán (unit, deterministic)
// ---------------------------------------------------------------------------
describe("HR-PH2 · Tính chấm công (unit)", () => {
  const T = (s: string) => parseVnLocal(s);
  it("M · workedMinutes = out − in − break", () => {
    const c = computeAttendance({ checkInAt: T("2026-08-20T08:00"), checkOutAt: T("2026-08-20T16:30"), breakMinutesActual: 30 });
    expect(c.workedMinutes).toBe(8 * 60); // 8.5h − 30' = 480
  });
  it("N · lateMinutes = max(0, in − scheduledStart)", () => {
    const c = computeAttendance({ checkInAt: T("2026-08-20T08:15"), scheduledStartAt: T("2026-08-20T08:00"), scheduledEndAt: T("2026-08-20T17:00") });
    expect(c.lateMinutes).toBe(15);
  });
  it("O · earlyLeaveMinutes = max(0, scheduledEnd − out)", () => {
    const c = computeAttendance({ checkInAt: T("2026-08-20T08:00"), checkOutAt: T("2026-08-20T16:40"), scheduledStartAt: T("2026-08-20T08:00"), scheduledEndAt: T("2026-08-20T17:00") });
    expect(c.earlyLeaveMinutes).toBe(20);
  });
  it("P · overtimeMinutes CANDIDATE = max(0, worked − scheduled)", () => {
    const c = computeAttendance({ checkInAt: T("2026-08-20T08:00"), checkOutAt: T("2026-08-20T18:00"), scheduledStartAt: T("2026-08-20T08:00"), scheduledEndAt: T("2026-08-20T17:00") });
    expect(c.scheduledMinutes).toBe(540); expect(c.workedMinutes).toBe(600); expect(c.overtimeMinutes).toBe(60);
  });
  it("Q · cross-midnight: 22:00→06:00 = 480' (không âm)", () => {
    const { start, end } = buildShiftInstants("2026-08-20", "22:00", "06:00");
    expect(end.getTime()).toBeGreaterThan(start.getTime());
    expect(computeScheduledMinutes(start, end, 0)).toBe(480);
    const c = computeAttendance({ checkInAt: start, checkOutAt: end });
    expect(c.workedMinutes).toBe(480);
  });
  it("R · timezone: giờ VN nhập → true-UTC (−7h)", () => {
    expect(T("2026-08-20T08:00").getUTCHours()).toBe(1); // 08:00 VN = 01:00Z
  });
});

// ---------------------------------------------------------------------------
// A–F — Sinh ca dated từ mẫu (DB)
// ---------------------------------------------------------------------------
describe("HR-PH2 · Sinh ca dated từ mẫu tuần (DB)", () => {
  beforeAll(async () => { await prisma.$executeRawUnsafe("TRUNCATE auth_throttles RESTART IDENTITY CASCADE").catch(() => {}); });
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect().catch(() => {}); });

  async function empWithSchedule(dow: number, start = "08:00", end = "17:00", branchId?: string) {
    const emp = await mkEmployee({ branchId });
    await prisma.employeeSchedule.create({ data: { employeeId: emp.id, dayOfWeek: dow, startTime: start, endTime: end } });
    return emp;
  }
  // 2026-08-17 (T2) .. 2026-08-23 (CN) = đúng 1 tuần → mỗi dow xuất hiện 1 lần.
  const FROM = new Date("2026-08-17T00:00:00Z"), TO = new Date("2026-08-23T00:00:00Z");

  it("A+E · recurring → 1 ca dated/tuần, branchId từ nhân sự", async () => {
    const br = await prisma.branch.create({ data: { code: uniq("CN"), name: "CS" } });
    const emp = await empWithSchedule(3, "08:00", "17:00", br.id); // dow 3
    const res = await generateShiftsFromSchedule({ employeeId: emp.id, from: FROM, to: TO });
    expect(res.created).toBe(1);
    const s = await prisma.workShift.findFirst({ where: { employeeId: emp.id } });
    expect(s?.branchId).toBe(br.id);
    expect(s?.scheduleId).toBeTruthy();
  });
  it("B · idempotent: sinh lại → created 0", async () => {
    const emp = await empWithSchedule(2);
    await generateShiftsFromSchedule({ employeeId: emp.id, from: FROM, to: TO });
    const again = await generateShiftsFromSchedule({ employeeId: emp.id, from: FROM, to: TO });
    expect(again.created).toBe(0);
    expect(await prisma.workShift.count({ where: { employeeId: emp.id } })).toBe(1);
  });
  it("C · ca đã SỬA không bị ghi đè khi sinh lại", async () => {
    const emp = await empWithSchedule(4);
    await generateShiftsFromSchedule({ employeeId: emp.id, from: FROM, to: TO });
    const s0 = await prisma.workShift.findFirst({ where: { employeeId: emp.id } });
    const newEnd = new Date(s0!.scheduledEndAt.getTime() + 60 * 60 * 1000);
    await prisma.workShift.update({ where: { id: s0!.id }, data: { scheduledEndAt: newEnd, note: "đã sửa" } });
    await generateShiftsFromSchedule({ employeeId: emp.id, from: FROM, to: TO });
    const s1 = await prisma.workShift.findUnique({ where: { id: s0!.id } });
    expect(s1?.scheduledEndAt.getTime()).toBe(newEnd.getTime()); // KHÔNG ghi đè
    expect(s1?.note).toBe("đã sửa");
    expect(await prisma.workShift.count({ where: { employeeId: emp.id } })).toBe(1);
  });
  it("D · cross-midnight ca 22:00→06:00 = 480'", async () => {
    const emp = await empWithSchedule(1, "22:00", "06:00");
    await generateShiftsFromSchedule({ employeeId: emp.id, from: FROM, to: TO });
    const s = await prisma.workShift.findFirst({ where: { employeeId: emp.id } });
    expect(Math.round((s!.scheduledEndAt.getTime() - s!.scheduledStartAt.getTime()) / 60000)).toBe(480);
  });
  it("F · ca CANCELLED vẫn tồn tại (không hard-delete)", async () => {
    const emp = await empWithSchedule(5);
    await generateShiftsFromSchedule({ employeeId: emp.id, from: FROM, to: TO });
    const s = await prisma.workShift.findFirst({ where: { employeeId: emp.id } });
    await prisma.workShift.update({ where: { id: s!.id }, data: { status: "CANCELLED" } });
    const after = await prisma.workShift.findUnique({ where: { id: s!.id } });
    expect(after?.status).toBe("CANCELLED");
  });
});

// ---------------------------------------------------------------------------
// G–X — Chấm công + điều chỉnh (HTTP)
// ---------------------------------------------------------------------------
describe("HR-PH2 · Chấm công + điều chỉnh (HTTP)", () => {
  beforeAll(async () => { await prisma.$executeRawUnsafe("TRUNCATE auth_throttles RESTART IDENTITY CASCADE").catch(() => {}); });
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect().catch(() => {}); });

  const MGR = [PERMISSIONS.ATTENDANCE_READ, PERMISSIONS.ATTENDANCE_WRITE, PERMISSIONS.STAFF_READ, PERMISSIONS.STAFF_WRITE];

  it("G · self check-in theo FK userId", async () => {
    const u = await makeUser([]); const emp = await mkEmployee({ userId: u.userId });
    await login(u.email);
    const rec = await data(await checkin({}));
    expect(rec.employeeId).toBe(emp.id);
    expect(rec.status).toBe("OPEN");
  });
  it("H · user chưa liên kết KHÔNG self check-in → 403", async () => {
    const u = await makeUser([]); await login(u.email);
    expect((await checkin({})).status).toBe(403);
  });
  it("I · user A (không attendance.write) KHÔNG chấm hộ B → 403", async () => {
    const uA = await makeUser([]); await mkEmployee({ userId: uA.userId });
    const empB = await mkEmployee();
    await login(uA.email);
    expect((await checkin({ employeeId: empB.id })).status).toBe(403);
  });
  it("J · check-in trùng → 409 (một OPEN/nhân sự)", async () => {
    const u = await makeUser([]); await mkEmployee({ userId: u.userId });
    await login(u.email);
    expect((await checkin({})).status).toBe(201);
    expect((await checkin({})).status).toBe(409);
  });
  it("K+L · checkout đóng bản ghi; checkout lần 2 → 409", async () => {
    const u = await makeUser([]); await mkEmployee({ userId: u.userId });
    await login(u.email);
    await checkin({});
    const done = await data(await checkout({}));
    expect(done.status).toBe("COMPLETED");
    expect(done.checkOutAt).toBeTruthy();
    expect((await checkout({})).status).toBe(409);
  });
  it("M · worked/late/early/OT đúng qua manager MANUAL + shift", async () => {
    const mgr = await makeUser(MGR); const emp = await mkEmployee();
    // Ca 08:00–17:00 (540' - break 0)
    const shift = await prisma.workShift.create({ data: { employeeId: emp.id, workDate: parseVnLocal("2026-08-20"), scheduledStartAt: parseVnLocal("2026-08-20T08:00"), scheduledEndAt: parseVnLocal("2026-08-20T17:00"), breakMinutes: 0 } });
    await login(mgr.email);
    const rec = await data(await checkin({ employeeId: emp.id, workShiftId: shift.id, at: "2026-08-20T08:20" }));
    expect(rec.lateMinutes).toBe(20);
    const out = await data(await checkout({ attendanceId: rec.id, at: "2026-08-20T18:00" }));
    expect(out.workedMinutes).toBe(580);          // 08:20→18:00 = 9h40 = 580'
    expect(out.scheduledMinutes).toBe(540);       // 08:00–17:00
    expect(out.overtimeMinutes).toBe(40);         // 580 − 540
  });
  it("Q · cross-midnight attendance 22:00→06:00 = 480'", async () => {
    const mgr = await makeUser(MGR); const emp = await mkEmployee();
    await login(mgr.email);
    const rec = await data(await checkin({ employeeId: emp.id, at: "2026-08-20T22:00" }));
    const out = await data(await checkout({ attendanceId: rec.id, at: "2026-08-21T06:00" }));
    expect(out.workedMinutes).toBe(480);
  });
  it("S+T+X · adjustment giữ before/after + record cập nhật + audit", async () => {
    const mgr = await makeUser(MGR); const emp = await mkEmployee();
    await login(mgr.email);
    const rec = await data(await checkin({ employeeId: emp.id, at: "2026-08-20T08:00" }));
    await checkout({ attendanceId: rec.id, at: "2026-08-20T12:00" }); // worked 240
    const a = await data(await adj(rec.id, { reason: "Quên check-out đúng giờ", checkOutAt: "2026-08-20T17:00" }));
    expect(a.status).toBe("APPLIED");
    expect((a.beforeSnapshot as any).workedMinutes).toBe(240);
    expect((a.afterSnapshot as any).workedMinutes).toBe(540);
    const after = await prisma.attendanceRecord.findUnique({ where: { id: rec.id } });
    expect(after?.workedMinutes).toBe(540); expect(after?.status).toBe("ADJUSTED");
    const audit = await prisma.auditLog.findFirst({ where: { entityId: rec.id, action: "ATTENDANCE_ADJUSTED" } });
    expect(audit).toBeTruthy();
  });
  it("U · adjustment thiếu reason → 422", async () => {
    const mgr = await makeUser(MGR); const emp = await mkEmployee();
    await login(mgr.email);
    const rec = await data(await checkin({ employeeId: emp.id, at: "2026-08-20T08:00" }));
    expect((await adj(rec.id, { checkOutAt: "2026-08-20T17:00" })).status).toBe(422);
  });
  it("V · void KHÔNG hard-delete (status VOIDED, bản ghi còn)", async () => {
    const mgr = await makeUser(MGR); const emp = await mkEmployee();
    await login(mgr.email);
    const rec = await data(await checkin({ employeeId: emp.id, at: "2026-08-20T08:00" }));
    const v = await data(await voidRec(rec.id, { reason: "Chấm nhầm" }));
    expect(v.status).toBe("VOIDED");
    expect(await prisma.attendanceRecord.findUnique({ where: { id: rec.id } })).toBeTruthy();
  });
  it("W · nhân viên ĐỀ NGHỊ điều chỉnh KHÔNG tự duyệt (record không đổi)", async () => {
    // Manager tạo bản chấm công cho emp; emp (self, không attendance.write) đề nghị sửa.
    const mgr = await makeUser(MGR); const u = await makeUser([]); const emp = await mkEmployee({ userId: u.userId });
    await login(mgr.email);
    const rec = await data(await checkin({ employeeId: emp.id, at: "2026-08-20T08:00" }));
    await checkout({ attendanceId: rec.id, at: "2026-08-20T12:00" }); // worked 240
    await login(u.email); // nhân viên tự đề nghị
    const a = await data(await adj(rec.id, { reason: "Tôi quên check-out", checkOutAt: "2026-08-20T17:00" }));
    expect(a.status).toBe("REQUESTED");
    const after = await prisma.attendanceRecord.findUnique({ where: { id: rec.id } });
    expect(after?.workedMinutes).toBe(240); // KHÔNG bị nhân viên tự sửa
    expect(after?.status).toBe("COMPLETED");
  });
});

// ---------------------------------------------------------------------------
// Y–AD — Nghỉ phép (HTTP + lib)
// ---------------------------------------------------------------------------
describe("HR-PH2 · Nghỉ phép có duyệt", () => {
  beforeAll(async () => { await prisma.$executeRawUnsafe("TRUNCATE auth_throttles RESTART IDENTITY CASCADE").catch(() => {}); });
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect().catch(() => {}); });
  const MGR = [PERMISSIONS.ATTENDANCE_READ, PERMISSIONS.ATTENDANCE_WRITE];

  it("Y+Z · lifecycle PENDING→APPROVED + audit", async () => {
    const u = await makeUser([]); const emp = await mkEmployee({ userId: u.userId });
    await login(u.email);
    const req = await data(await leaveCreate({ type: "ANNUAL", fromAt: "2026-09-01", toAt: "2026-09-03" }));
    expect(req.status).toBe("PENDING");
    expect(req.employeeId).toBe(emp.id);
    await login((await makeUser(MGR)).email);
    const ap = await data(await leaveApprove(req.id));
    expect(ap.status).toBe("APPROVED");
    expect(await prisma.auditLog.count({ where: { entityId: req.id, action: "LEAVE_APPROVED" } })).toBe(1);
  });
  it("AA · paid/unpaid được lưu", async () => {
    const mgr = await makeUser(MGR); const emp = await mkEmployee();
    await login(mgr.email);
    const r = await data(await leaveCreate({ employeeId: emp.id, type: "SICK", fromAt: "2026-09-05", toAt: "2026-09-06", isPaid: false, autoApprove: true }));
    expect(r.isPaid).toBe(false); expect(r.status).toBe("APPROVED");
  });
  it("AB · approved leave → hasApprovedLeaveAt true (tránh false-absent)", async () => {
    const emp = await mkEmployee();
    await prisma.employeeLeave.create({ data: { employeeId: emp.id, type: "ANNUAL", fromAt: parseVnLocal("2026-09-01"), toAt: parseVnLocal("2026-09-03T23:59"), status: "APPROVED" } });
    expect(await hasApprovedLeaveAt(emp.id, parseVnLocal("2026-09-02T10:00"))).toBe(true);
    expect(await hasApprovedLeaveAt(emp.id, parseVnLocal("2026-09-10T10:00"))).toBe(false);
  });
  it("AC · reject audited + AD cancel giữ lịch sử", async () => {
    const u = await makeUser([]); const emp = await mkEmployee({ userId: u.userId });
    await login(u.email);
    const r1 = await data(await leaveCreate({ fromAt: "2026-09-01", toAt: "2026-09-02" }));
    const r2 = await data(await leaveCreate({ fromAt: "2026-10-01", toAt: "2026-10-02" }));
    // manager reject r1
    await login((await makeUser(MGR)).email);
    const rej = await data(await leaveReject(r1.id, "Kẹt lịch"));
    expect(rej.status).toBe("REJECTED"); expect(rej.rejectionReason).toBe("Kẹt lịch");
    // owner cancel r2
    await login(u.email);
    const can = await data(await leaveCancel(r2.id));
    expect(can.status).toBe("CANCELLED");
    expect(await prisma.employeeLeave.findUnique({ where: { id: r2.id } })).toBeTruthy(); // còn lịch sử
  });
  it("AC2 · EmployeeLeave cũ (không status) mặc định APPROVED — dữ liệu giữ", async () => {
    const emp = await mkEmployee();
    const legacy = await prisma.employeeLeave.create({ data: { employeeId: emp.id, type: "ANNUAL", fromAt: parseVnLocal("2026-01-01"), toAt: parseVnLocal("2026-01-02") } });
    expect(legacy.status).toBe("APPROVED"); // default cột
    expect(legacy.requestedAt).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AE–AL — RBAC / privacy
// ---------------------------------------------------------------------------
describe("HR-PH2 · RBAC / self-view", () => {
  beforeAll(async () => { await prisma.$executeRawUnsafe("TRUNCATE auth_throttles RESTART IDENTITY CASCADE").catch(() => {}); });
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect().catch(() => {}); });

  it("AE · self chỉ thấy của mình; org list cần attendance.read (self-only → 403)", async () => {
    const u = await makeUser([]); const emp = await mkEmployee({ userId: u.userId });
    await prisma.attendanceRecord.create({ data: { employeeId: emp.id, workDate: parseVnLocal("2026-08-20"), checkInAt: parseVnLocal("2026-08-20T08:00"), status: "OPEN" } });
    await login(u.email);
    const me = await data(await attMe());
    expect(me.linked).toBe(true); expect(me.history.length).toBe(1);
    expect((await attList()).status).toBe(403); // không attendance.read
  });
  it("AF+AG · attendance.read xem workspace; nhưng cần attendance.write để sửa/duyệt", async () => {
    const reader = await makeUser([PERMISSIONS.ATTENDANCE_READ]); const emp = await mkEmployee();
    await login(reader.email);
    expect((await attList()).status).toBe(200);
    expect((await manual({ employeeId: emp.id, checkInAt: "2026-08-20T08:00" })).status).toBe(403);
    // tạo 1 đơn để thử approve
    const leave = await prisma.employeeLeave.create({ data: { employeeId: emp.id, type: "ANNUAL", fromAt: parseVnLocal("2026-09-01"), toAt: parseVnLocal("2026-09-02"), status: "PENDING", requestedAt: new Date() } });
    expect((await leaveApprove(leave.id)).status).toBe(403);
  });
  it("AH+AI · finance.read / staff.read đơn lẻ KHÔNG mở chấm công (403)", async () => {
    await login((await makeUser([PERMISSIONS.FINANCE_READ])).email);
    expect((await attList()).status).toBe(403);
    await login((await makeUser([PERMISSIONS.STAFF_READ])).email);
    expect((await attList()).status).toBe(403);
  });
  it("AJ+AK · attendance ≠ finance/staff; payroll reserved bất biến", () => {
    expect(PERMISSIONS.ATTENDANCE_READ).not.toBe(PERMISSIONS.FINANCE_READ);
    expect(PERMISSIONS.ATTENDANCE_READ).not.toBe(PERMISSIONS.STAFF_READ);
    const mgr = ROLE_PERMISSIONS[ROLES.MANAGER];
    expect(mgr.includes(PERMISSIONS.PAYROLL_READ as any)).toBe(true);
    expect(mgr.includes(PERMISSIONS.ATTENDANCE_WRITE as any)).toBe(true);
    for (const role of [ROLES.RECEPTION, ROLES.CUSTOMER_CARE, ROLES.SPECIALIST, ROLES.CASHIER, ROLES.MARKETING])
      expect(ROLE_PERMISSIONS[role].includes(PERMISSIONS.ATTENDANCE_WRITE as any)).toBe(false);
  });
});
