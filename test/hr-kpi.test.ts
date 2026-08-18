// =============================================================================
// HR-PH4 — KPI ENGINE + PERIOD SNAPSHOT. Chứng minh A–AF.
//   Contribution KPI A–H · Attendance KPI I–O · Review KPI P–T ·
//   Snapshot U–Z · RBAC/Self AA–AF.
// FACT đáng tin (contribution/attendance) = VERIFIED; review name-based =
// LEGACY_NAME_MATCH; NET reversal (không đếm đôi); LOCKED bất biến;
// recompute supersede idempotent; drill-down evidence; self-view FK.
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
import { parseVnLocal } from "@/lib/timezone";
import { POST as staffLogin } from "@/app/api/auth/login/route";
import { GET as defList, POST as defCreate } from "@/app/api/kpi-definitions/route";
import { GET as periodList, POST as periodCreate } from "@/app/api/kpi-periods/route";
import { GET as periodGet, PATCH as periodPatch } from "@/app/api/kpi-periods/[id]/route";
import { POST as periodCalc } from "@/app/api/kpi-periods/[id]/calculate/route";
import { POST as periodRecalc } from "@/app/api/kpi-periods/[id]/recalculate/route";
import { POST as periodLock } from "@/app/api/kpi-periods/[id]/lock/route";
import { GET as snapList } from "@/app/api/employee-kpi-snapshots/route";
import { GET as evidenceGet } from "@/app/api/employee-kpi-snapshots/[id]/evidence/route";

let ip = 0;
async function rj(res: Response) { const t = await res.text(); try { return t ? JSON.parse(t) : null; } catch { return null; } }
const D = async (res: Response) => { const j = await rj(res); return j && "data" in j ? j.data : j; };
async function makeUser(perms: string[], over: { linkEmployeeId?: string } = {}) {
  const email = `${uniq("c")}@thng.com.vn`.toLowerCase();
  const user = await prisma.user.create({ data: { email, name: "U " + uniq("n"), passwordHash: await hashPassword("matkhau123") } });
  const role = await prisma.role.create({ data: { code: uniq("ROLE"), name: "R" } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  for (const c of perms) { const p = await prisma.permission.upsert({ where: { code: c }, update: {}, create: { code: c } }); await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: p.id } }); }
  if (over.linkEmployeeId) await prisma.employee.update({ where: { id: over.linkEmployeeId }, data: { userId: user.id } });
  return { email, userId: user.id };
}
async function login(email: string) {
  jar.clear();
  await staffLogin(new Request("http://t/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `10.73.0.${++ip}` }, body: JSON.stringify({ email, password: "matkhau123" }) }), {} as any);
}
const J = (b: unknown) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });

// --- API wrappers ---
const createPeriod = (b: unknown) => periodCreate(new Request("http://t/api/kpi-periods", J(b)), {} as any);
const listPeriods = () => periodList(new Request("http://t/api/kpi-periods"), {} as any);
const getPeriod = (id: string) => periodGet(new Request("http://t/api/kpi-periods/" + id), { params: { id } } as any);
const patchPeriod = (id: string, b: unknown) => periodPatch(new Request("http://t/api/kpi-periods/" + id, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }), { params: { id } } as any);
const calc = (id: string) => periodCalc(new Request("http://t/api/kpi-periods/" + id + "/calculate", { method: "POST" }), { params: { id } } as any);
const recalc = (id: string) => periodRecalc(new Request("http://t/api/kpi-periods/" + id + "/recalculate", { method: "POST" }), { params: { id } } as any);
const lock = (id: string) => periodLock(new Request("http://t/api/kpi-periods/" + id + "/lock", { method: "POST" }), { params: { id } } as any);
const snaps = (qs = "") => snapList(new Request("http://t/api/employee-kpi-snapshots" + qs), {} as any);
const evidence = (id: string) => evidenceGet(new Request("http://t/api/employee-kpi-snapshots/" + id + "/evidence"), { params: { id } } as any);
const defs = () => defList(new Request("http://t/api/kpi-definitions"), {} as any);
const createDef = (b: unknown) => defCreate(new Request("http://t/api/kpi-definitions", J(b)), {} as any);

const MANAGER = [PERMISSIONS.ATTENDANCE_READ, PERMISSIONS.ATTENDANCE_WRITE, PERMISSIONS.TREATMENT_READ, PERMISSIONS.TREATMENT_WRITE];

// --- fact builders (direct prisma for determinism) ---
async function mkEmp(over: { fullName?: string; status?: string; branchId?: string; title?: string } = {}) {
  return prisma.employee.create({ data: { code: uniq("NV"), fullName: over.fullName ?? "NV " + uniq("x"), title: over.title ?? "KTV", status: (over.status as any) ?? "ACTIVE", isActive: (over.status ?? "ACTIVE") === "ACTIVE", branchId: over.branchId ?? null } });
}
async function mkSession(over: { incident?: string } = {}) {
  const cust = await prisma.customer.create({ data: { code: uniq("KH"), fullName: "KH" } });
  return prisma.treatmentSession.create({ data: { code: uniq("SS"), customerId: cust.id, sessionNumber: 1, status: "COMPLETED", performedAt: parseVnLocal("2026-01-10T09:00"), incident: over.incident ?? null } });
}
async function mkItem(sessionId: string) {
  const svc = await prisma.service.create({ data: { code: uniq("DV"), name: "DV " + uniq("s"), standardPrice: 0 } });
  return prisma.sessionExecutionItem.create({ data: { sessionId, serviceId: svc.id, sortOrder: 0 } });
}
async function mkContrib(sessionId: string, employeeId: string, over: { itemId?: string; minutes?: number; branchId?: string; role?: string; startedAt?: string; status?: string; entryKind?: string } = {}) {
  return prisma.sessionStaffContribution.create({
    data: {
      treatmentSessionId: sessionId, employeeId, sessionExecutionItemId: over.itemId ?? null,
      employeeNameSnapshot: "NV snap", employeeRoleSnapshot: over.role ?? "PRIMARY_OPERATOR", contributionTypeCode: "PRIMARY_OPERATOR",
      actualMinutes: over.minutes ?? null, branchId: over.branchId ?? null, startedAt: parseVnLocal(over.startedAt ?? "2026-01-10T09:00"),
      entryKind: (over.entryKind as any) ?? "CONTRIBUTION", status: (over.status as any) ?? "ACTIVE",
    },
  });
}
async function mkAtt(employeeId: string, over: { day?: string; worked?: number; late?: number; early?: number; ot?: number; branchId?: string; status?: string } = {}) {
  const day = over.day ?? "2026-01-10";
  return prisma.attendanceRecord.create({ data: { employeeId, workDate: parseVnLocal(day), checkInAt: parseVnLocal(day + "T08:00"), checkOutAt: parseVnLocal(day + "T17:00"), workedMinutes: over.worked ?? 480, lateMinutes: over.late ?? 0, earlyLeaveMinutes: over.early ?? 0, overtimeMinutes: over.ot ?? 0, branchId: over.branchId ?? null, status: (over.status as any) ?? "COMPLETED" } });
}
async function mkReview(sessionId: string, customerId: string, over: { tech?: number; sat?: number; name?: string; employeeId?: string } = {}) {
  return prisma.sessionReview.create({ data: { sessionId, customerId, technicianScore: over.tech ?? null, satisfactionScore: over.sat ?? null, technicianName: over.name ?? null, employeeId: over.employeeId ?? null, createdAt: parseVnLocal("2026-01-12T10:00") } });
}
async function mkLeave(employeeId: string, from: string, to: string, isPaid = true) {
  return prisma.employeeLeave.create({ data: { employeeId, type: "ANNUAL", fromAt: parseVnLocal(from), toAt: parseVnLocal(to), status: "APPROVED", isPaid } });
}
async function newPeriod(over: { branchId?: string } = {}) {
  const r = await createPeriod({ name: "Kỳ 01/2026", startDate: "2026-01-01", endDate: "2026-01-31", ...(over.branchId ? { branchId: over.branchId } : {}) });
  return (await D(r)) as any;
}
// snapshot value cho (employee, kpiCode) từ DB (CURRENT)
async function snapVal(periodId: string, employeeId: string, code: string) {
  const def = await prisma.kpiDefinition.findUnique({ where: { code } });
  const s = await prisma.employeeKpiSnapshot.findFirst({ where: { kpiPeriodId: periodId, employeeId, kpiDefinitionId: def!.id, status: "CURRENT" } });
  return s ? { value: Number(s.value), sourceCount: s.sourceCount, sourceQuality: s.sourceQuality, id: s.id } : null;
}

async function bootManager() { const m = await makeUser(MANAGER); await login(m.email); return m; }

describe("HR-PH4 · Contribution KPI (A–H)", () => {
  beforeAll(async () => { await prisma.$executeRawUnsafe("TRUNCATE auth_throttles RESTART IDENTITY CASCADE").catch(() => {}); });
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect().catch(() => {}); });

  it("A+B+C: sessions_contributed / services_performed / treatment_minutes đúng", async () => {
    await bootManager();
    const emp = await mkEmp();
    const s1 = await mkSession(); const i1 = await mkItem(s1.id); const i2 = await mkItem(s1.id);
    const s2 = await mkSession(); const i3 = await mkItem(s2.id);
    await mkContrib(s1.id, emp.id, { itemId: i1.id, minutes: 30 });
    await mkContrib(s1.id, emp.id, { itemId: i2.id, minutes: 20 });
    await mkContrib(s2.id, emp.id, { itemId: i3.id, minutes: 40 });
    const p = await newPeriod();
    await calc(p.id);
    expect((await snapVal(p.id, emp.id, "sessions_contributed"))!.value).toBe(2);
    expect((await snapVal(p.id, emp.id, "services_performed"))!.value).toBe(3);
    expect((await snapVal(p.id, emp.id, "treatment_minutes"))!.value).toBe(90);
  });

  it("D: reversal NET — bản đã REVERSED + dòng REVERSAL bị loại (không đếm đôi)", async () => {
    await bootManager();
    const emp = await mkEmp();
    const s1 = await mkSession(); const i1 = await mkItem(s1.id);
    await mkContrib(s1.id, emp.id, { itemId: i1.id, minutes: 50 }); // ACTIVE
    const s2 = await mkSession(); const i2 = await mkItem(s2.id);
    const rev = await mkContrib(s2.id, emp.id, { itemId: i2.id, minutes: 25, status: "REVERSED" }); // đã hoàn tác
    await mkContrib(s2.id, emp.id, { itemId: i2.id, minutes: -25, entryKind: "REVERSAL" }); // dòng bù
    await prisma.sessionStaffContribution.update({ where: { id: rev.id }, data: { reversedAt: new Date() } });
    const p = await newPeriod();
    await calc(p.id);
    expect((await snapVal(p.id, emp.id, "sessions_contributed"))!.value).toBe(1); // chỉ s1
    expect((await snapVal(p.id, emp.id, "treatment_minutes"))!.value).toBe(50); // không trừ về 0, không đếm -25
  });

  it("E: contribution sửa (thêm) trước khi khóa được phản ánh khi tính lại", async () => {
    await bootManager();
    const emp = await mkEmp();
    const s1 = await mkSession(); const i1 = await mkItem(s1.id);
    await mkContrib(s1.id, emp.id, { itemId: i1.id, minutes: 30 });
    const p = await newPeriod();
    await calc(p.id);
    expect((await snapVal(p.id, emp.id, "treatment_minutes"))!.value).toBe(30);
    const s2 = await mkSession(); const i2 = await mkItem(s2.id);
    await mkContrib(s2.id, emp.id, { itemId: i2.id, minutes: 45 });
    await recalc(p.id);
    expect((await snapVal(p.id, emp.id, "treatment_minutes"))!.value).toBe(75);
  });

  it("F: multi-staff — mỗi nhân sự quy đúng phần của mình", async () => {
    await bootManager();
    const a = await mkEmp(); const b = await mkEmp();
    const s = await mkSession(); const i = await mkItem(s.id);
    await mkContrib(s.id, a.id, { itemId: i.id, minutes: 40 });
    await mkContrib(s.id, b.id, { itemId: i.id, minutes: 15 });
    const p = await newPeriod();
    await calc(p.id);
    expect((await snapVal(p.id, a.id, "treatment_minutes"))!.value).toBe(40);
    expect((await snapVal(p.id, b.id, "treatment_minutes"))!.value).toBe(15);
  });

  it("G: branch suy từ FACT tại thời điểm (kỳ lọc theo chi nhánh)", async () => {
    await bootManager();
    const emp = await mkEmp();
    const br = await prisma.branch.create({ data: { code: uniq("CN"), name: "CN1" } });
    const s1 = await mkSession(); const i1 = await mkItem(s1.id);
    const s2 = await mkSession(); const i2 = await mkItem(s2.id);
    await mkContrib(s1.id, emp.id, { itemId: i1.id, minutes: 30, branchId: br.id }); // trong chi nhánh
    await mkContrib(s2.id, emp.id, { itemId: i2.id, minutes: 99 }); // ngoài chi nhánh (null)
    const p = await newPeriod({ branchId: br.id });
    await calc(p.id);
    const v = await snapVal(p.id, emp.id, "treatment_minutes");
    expect(v!.value).toBe(30); // chỉ FACT của chi nhánh
    const s = await prisma.employeeKpiSnapshot.findFirst({ where: { kpiPeriodId: p.id, employeeId: emp.id, status: "CURRENT" } });
    expect(s!.branchSnapshot).toBe(br.id);
  });

  it("H: role-in-session snapshot KHÔNG bị viết lại từ hồ sơ hiện tại", async () => {
    await bootManager();
    const emp = await mkEmp({ title: "KTV" });
    const s = await mkSession(); const i = await mkItem(s.id);
    const c = await mkContrib(s.id, emp.id, { itemId: i.id, minutes: 20, role: "MASTER_SUPERVISION" });
    await prisma.employee.update({ where: { id: emp.id }, data: { title: "Trưởng nhóm mới" } });
    const p = await newPeriod();
    await calc(p.id);
    const after = await prisma.sessionStaffContribution.findUnique({ where: { id: c.id } });
    expect(after!.employeeRoleSnapshot).toBe("MASTER_SUPERVISION"); // giữ nguyên
    expect((await snapVal(p.id, emp.id, "treatment_minutes"))!.value).toBe(20);
  });
});

describe("HR-PH4 · Attendance KPI (I–O)", () => {
  beforeAll(async () => { await prisma.$executeRawUnsafe("TRUNCATE auth_throttles RESTART IDENTITY CASCADE").catch(() => {}); });
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect().catch(() => {}); });

  it("I+J+K+L+M: worked/attendance_days/late/early/OT đúng", async () => {
    await bootManager();
    const emp = await mkEmp();
    await mkAtt(emp.id, { day: "2026-01-10", worked: 480, late: 10, early: 5, ot: 30 });
    await mkAtt(emp.id, { day: "2026-01-11", worked: 420, late: 0, early: 0, ot: 0 });
    const p = await newPeriod();
    await calc(p.id);
    expect((await snapVal(p.id, emp.id, "worked_minutes"))!.value).toBe(900);
    expect((await snapVal(p.id, emp.id, "attendance_days"))!.value).toBe(2);
    expect((await snapVal(p.id, emp.id, "late_minutes"))!.value).toBe(10);
    expect((await snapVal(p.id, emp.id, "early_leave_minutes"))!.value).toBe(5);
    expect((await snapVal(p.id, emp.id, "overtime_candidate_minutes"))!.value).toBe(30);
  });

  it("N: nghỉ có duyệt KHÔNG bị coi là vắng thô; ghi nhận approved_leave_days", async () => {
    await bootManager();
    const emp = await mkEmp();
    await mkAtt(emp.id, { day: "2026-01-10", worked: 480 });
    await mkLeave(emp.id, "2026-01-15", "2026-01-16"); // 1 ngày nghỉ có duyệt
    const p = await newPeriod();
    await calc(p.id);
    expect((await snapVal(p.id, emp.id, "worked_minutes"))!.value).toBe(480); // không bị trừ vì nghỉ
    expect((await snapVal(p.id, emp.id, "approved_leave_days"))!.value).toBeGreaterThanOrEqual(1);
  });

  it("O: attendance cross-midnight đếm đúng theo workDate (1 ngày công)", async () => {
    await bootManager();
    const emp = await mkEmp();
    await prisma.attendanceRecord.create({ data: { employeeId: emp.id, workDate: parseVnLocal("2026-01-10"), checkInAt: parseVnLocal("2026-01-10T22:00"), checkOutAt: parseVnLocal("2026-01-11T02:00"), workedMinutes: 240, status: "COMPLETED" } });
    const p = await newPeriod();
    await calc(p.id);
    expect((await snapVal(p.id, emp.id, "worked_minutes"))!.value).toBe(240);
    expect((await snapVal(p.id, emp.id, "attendance_days"))!.value).toBe(1);
  });
});

describe("HR-PH4 · Review KPI + source quality (P–T)", () => {
  beforeAll(async () => { await prisma.$executeRawUnsafe("TRUNCATE auth_throttles RESTART IDENTITY CASCADE").catch(() => {}); });
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect().catch(() => {}); });

  it("P+Q+R: avg technician/satisfaction + review_count (khớp FK → VERIFIED)", async () => {
    await bootManager();
    const emp = await mkEmp({ fullName: "Nguyễn Văn Riêng" });
    const s1 = await mkSession(); const s2 = await mkSession();
    await mkReview(s1.id, s1.customerId, { tech: 5, sat: 4, employeeId: emp.id });
    await mkReview(s2.id, s2.customerId, { tech: 3, sat: 2, employeeId: emp.id });
    const p = await newPeriod();
    await calc(p.id);
    expect((await snapVal(p.id, emp.id, "avg_technician_score"))!.value).toBe(4);
    expect((await snapVal(p.id, emp.id, "avg_satisfaction"))!.value).toBe(3);
    const rc = await snapVal(p.id, emp.id, "review_count");
    expect(rc!.value).toBe(2);
    expect(rc!.sourceQuality).toBe("VERIFIED");
  });

  it("S: review chỉ khớp TÊN (tên duy nhất) → LEGACY_NAME_MATCH", async () => {
    await bootManager();
    const emp = await mkEmp({ fullName: "Trần Thị Duy Nhất" });
    const s1 = await mkSession();
    await mkReview(s1.id, s1.customerId, { tech: 4, sat: 5, name: "Trần Thị Duy Nhất" }); // name-only
    const p = await newPeriod();
    await calc(p.id);
    const rc = await snapVal(p.id, emp.id, "review_count");
    expect(rc!.value).toBe(1);
    expect(rc!.sourceQuality).toBe("LEGACY_NAME_MATCH");
  });

  it("T: tên TRÙNG (không duy nhất) → KHÔNG quy nhầm review name-only cho nhân sự", async () => {
    await bootManager();
    const a = await mkEmp({ fullName: "Lê Văn Trùng" });
    await mkEmp({ fullName: "Lê Văn Trùng" }); // trùng tên → ambiguous
    const s1 = await mkSession();
    await mkReview(s1.id, s1.customerId, { tech: 5, sat: 5, name: "Lê Văn Trùng" }); // name-only, ambiguous
    const p = await newPeriod();
    await calc(p.id);
    const rc = await snapVal(p.id, a.id, "review_count");
    expect(rc!.value).toBe(0); // KHÔNG quy cho A
    expect(rc!.sourceQuality).toBe("INSUFFICIENT");
  });
});

describe("HR-PH4 · Snapshot lifecycle (U–Z)", () => {
  beforeAll(async () => { await prisma.$executeRawUnsafe("TRUNCATE auth_throttles RESTART IDENTITY CASCADE").catch(() => {}); });
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect().catch(() => {}); });

  it("U: calculate tạo snapshot CURRENT + cập nhật kỳ CALCULATED", async () => {
    await bootManager();
    const emp = await mkEmp();
    const s = await mkSession(); const i = await mkItem(s.id);
    await mkContrib(s.id, emp.id, { itemId: i.id, minutes: 10 });
    const p = await newPeriod();
    const res = await D(await calc(p.id));
    expect(res.snapshots).toBeGreaterThan(0);
    const per = await prisma.kpiPeriod.findUnique({ where: { id: p.id } });
    expect(per!.status).toBe("CALCULATED");
    const cur = await prisma.employeeKpiSnapshot.count({ where: { kpiPeriodId: p.id, status: "CURRENT" } });
    expect(cur).toBe(res.snapshots);
  });

  it("V: recalculate idempotent — giá trị bằng nhau, đúng 1 CURRENT/(nv,def), bản cũ SUPERSEDED", async () => {
    await bootManager();
    const emp = await mkEmp();
    const s = await mkSession(); const i = await mkItem(s.id);
    await mkContrib(s.id, emp.id, { itemId: i.id, minutes: 33 });
    const p = await newPeriod();
    await calc(p.id);
    const v1 = (await snapVal(p.id, emp.id, "treatment_minutes"))!.value;
    await recalc(p.id);
    const v2 = (await snapVal(p.id, emp.id, "treatment_minutes"))!.value;
    expect(v2).toBe(v1);
    const def = await prisma.kpiDefinition.findUnique({ where: { code: "treatment_minutes" } });
    const cur = await prisma.employeeKpiSnapshot.count({ where: { kpiPeriodId: p.id, employeeId: emp.id, kpiDefinitionId: def!.id, status: "CURRENT" } });
    expect(cur).toBe(1); // đúng 1 CURRENT
    const sup = await prisma.employeeKpiSnapshot.count({ where: { kpiPeriodId: p.id, employeeId: emp.id, kpiDefinitionId: def!.id, status: "SUPERSEDED" } });
    expect(sup).toBe(1); // bản trước bị supersede (append-only)
  });

  it("W: kỳ LOCKED bất biến — recalculate 409", async () => {
    await bootManager();
    const emp = await mkEmp();
    const s = await mkSession(); const i = await mkItem(s.id);
    await mkContrib(s.id, emp.id, { itemId: i.id, minutes: 12 });
    const p = await newPeriod();
    await calc(p.id);
    await lock(p.id);
    const r = await recalc(p.id);
    expect(r.status).toBe(409);
    const per = await prisma.kpiPeriod.findUnique({ where: { id: p.id } });
    expect(per!.status).toBe("LOCKED");
  });

  it("X: thay đổi nguồn SAU khi khóa KHÔNG làm đổi snapshot đã khóa", async () => {
    await bootManager();
    const emp = await mkEmp();
    const s = await mkSession(); const i = await mkItem(s.id);
    await mkContrib(s.id, emp.id, { itemId: i.id, minutes: 20 });
    const p = await newPeriod();
    await calc(p.id);
    await lock(p.id);
    const before = (await snapVal(p.id, emp.id, "treatment_minutes"))!.value;
    // thêm contribution sau khi khóa
    const s2 = await mkSession(); const i2 = await mkItem(s2.id);
    await mkContrib(s2.id, emp.id, { itemId: i2.id, minutes: 999 });
    const after = (await snapVal(p.id, emp.id, "treatment_minutes"))!.value;
    expect(after).toBe(before); // snapshot khóa không đổi
  });

  it("Y+Z: calculationSnapshot tái lập giá trị + sourceCount đúng + drill-down evidence", async () => {
    const m = await bootManager();
    const emp = await mkEmp();
    const s = await mkSession(); const i = await mkItem(s.id);
    await mkContrib(s.id, emp.id, { itemId: i.id, minutes: 60 });
    const p = await newPeriod();
    await calc(p.id);
    const sv = await snapVal(p.id, emp.id, "treatment_minutes");
    const snap = await prisma.employeeKpiSnapshot.findUnique({ where: { id: sv!.id } });
    const cs: any = snap!.calculationSnapshot;
    expect(cs.value).toBe(60); // giá trị nằm trong bằng chứng
    expect(cs.evidence.lines.reduce((a: number, l: any) => a + l.minutes, 0)).toBe(60);
    expect(sv!.sourceCount).toBe(1);
    // drill-down endpoint trả bản ghi nguồn
    await login(m.email);
    const ev = await D(await evidence(sv!.id));
    expect(ev.records.contributions.length).toBe(1);
    expect(Number(ev.snapshot.value)).toBe(60);
  });
});

describe("HR-PH4 · RBAC / Self-view (AA–AF)", () => {
  beforeAll(async () => { await prisma.$executeRawUnsafe("TRUNCATE auth_throttles RESTART IDENTITY CASCADE").catch(() => {}); });
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect().catch(() => {}); });

  async function seedTwoEmployeesCalculated() {
    const m = await bootManager();
    const a = await mkEmp(); const b = await mkEmp();
    const s1 = await mkSession(); const i1 = await mkItem(s1.id); await mkContrib(s1.id, a.id, { itemId: i1.id, minutes: 30 });
    const s2 = await mkSession(); const i2 = await mkItem(s2.id); await mkContrib(s2.id, b.id, { itemId: i2.id, minutes: 40 });
    const p = await newPeriod();
    await calc(p.id);
    return { m, a, b, p };
  }

  it("AA: self (đã liên kết, KHÔNG attendance.read) chỉ thấy KPI CỦA MÌNH", async () => {
    const { a } = await seedTwoEmployeesCalculated();
    const selfUser = await makeUser([PERMISSIONS.TREATMENT_READ], { linkEmployeeId: a.id });
    await login(selfUser.email);
    const rows = await D(await snaps());
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r: any) => r.employeeId === a.id)).toBe(true);
  });

  it("AB: self KHÔNG xem được KPI của người khác (scope cứng theo self)", async () => {
    const { a, b } = await seedTwoEmployeesCalculated();
    const selfUser = await makeUser([PERMISSIONS.TREATMENT_READ], { linkEmployeeId: a.id });
    await login(selfUser.email);
    const rows = await D(await snaps("?employeeId=" + b.id)); // cố xem của B
    expect(rows.every((r: any) => r.employeeId === a.id)).toBe(true); // vẫn chỉ của A
    expect(rows.some((r: any) => r.employeeId === b.id)).toBe(false);
  });

  it("AC: manager (attendance.read) thấy KPI toàn tổ chức", async () => {
    const { m } = await seedTwoEmployeesCalculated();
    await login(m.email);
    const rows = await D(await snaps());
    const empIds = new Set(rows.map((r: any) => r.employeeId));
    expect(empIds.size).toBeGreaterThanOrEqual(2);
  });

  it("AD: finance.read ĐƠN LẺ không cấp quyền quản lý KPI (tạo/tính → 403)", async () => {
    const u = await makeUser([PERMISSIONS.FINANCE_READ]);
    await login(u.email);
    const r1 = await createPeriod({ name: "x", startDate: "2026-01-01", endDate: "2026-01-31" });
    expect(r1.status).toBe(403);
  });

  it("AE: payroll.read KHÔNG bắt buộc để xem KPI thường (attendance.read đủ)", async () => {
    await seedTwoEmployeesCalculated();
    const u = await makeUser([PERMISSIONS.ATTENDANCE_READ]); // không payroll.read
    await login(u.email);
    const r = await snaps();
    expect(r.status).toBe(200);
    // ẩn danh → 401
    jar.clear();
    const anon = await snaps();
    expect(anon.status).toBe(401);
  });

  it("AF: multi-role UNION quyền — read + write cộng gộp hoạt động", async () => {
    // user 2 vai trò: 1 có attendance.read, 1 có attendance.write
    const email = `${uniq("c")}@thng.com.vn`.toLowerCase();
    const user = await prisma.user.create({ data: { email, name: "Union", passwordHash: await hashPassword("matkhau123") } });
    const r1 = await prisma.role.create({ data: { code: uniq("R1"), name: "R1" } });
    const r2 = await prisma.role.create({ data: { code: uniq("R2"), name: "R2" } });
    await prisma.userRole.createMany({ data: [{ userId: user.id, roleId: r1.id }, { userId: user.id, roleId: r2.id }] });
    for (const [rid, code] of [[r1.id, PERMISSIONS.ATTENDANCE_READ], [r2.id, PERMISSIONS.ATTENDANCE_WRITE]] as const) {
      const p = await prisma.permission.upsert({ where: { code }, update: {}, create: { code } });
      await prisma.rolePermission.create({ data: { roleId: rid, permissionId: p.id } });
    }
    await login(email);
    const created = await createPeriod({ name: "Union kỳ", startDate: "2026-01-01", endDate: "2026-01-31" });
    expect(created.status).toBe(201);
    const per = await D(created);
    const calcRes = await calc(per.id);
    expect(calcRes.status).toBe(200);
    const list = await snaps();
    expect(list.status).toBe(200);
  });
});
