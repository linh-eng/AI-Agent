// =============================================================================
// HR-PH3 — Sổ đóng góp nhân sự theo buổi. Chứng minh A–AM.
//   Basic A–I · Integrity J–Q · Attendance cross-check R–X · Freeze/Reversal Y–AE ·
//   RBAC/Self AF–AM. Immutable snapshot + compensating reversal + không hard-delete.
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
import { GET as listRaw, POST as createRaw } from "@/app/api/session-staff-contributions/route";
import { GET as getRaw, PATCH as patchRaw } from "@/app/api/session-staff-contributions/[id]/route";
import { POST as reverseRaw } from "@/app/api/session-staff-contributions/[id]/reverse/route";

let ip = 0;
async function rj(res: Response) { const t = await res.text(); try { return t ? JSON.parse(t) : null; } catch { return null; } }
const D = async (res: Response) => { const j = await rj(res); return j && "data" in j ? j.data : j; };
async function makeUser(perms: string[]) {
  const email = `${uniq("c")}@thng.com.vn`.toLowerCase();
  const user = await prisma.user.create({ data: { email, name: "NV", passwordHash: await hashPassword("matkhau123") } });
  const role = await prisma.role.create({ data: { code: uniq("ROLE"), name: "R" } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  for (const c of perms) { const p = await prisma.permission.upsert({ where: { code: c }, update: {}, create: { code: c } }); await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: p.id } }); }
  return { email, userId: user.id };
}
async function login(email: string) {
  jar.clear();
  await staffLogin(new Request("http://t/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `10.71.0.${++ip}` }, body: JSON.stringify({ email, password: "matkhau123" }) }), {} as any);
}
const J = (b: unknown) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
const create = (b: unknown) => createRaw(new Request("http://t/api/session-staff-contributions", J(b)), {} as any);
const list = (qs = "") => listRaw(new Request("http://t/api/session-staff-contributions" + qs), {} as any);
const get = (id: string) => getRaw(new Request("http://t/api/session-staff-contributions/" + id), { params: { id } } as any);
const patch = (id: string, b: unknown) => patchRaw(new Request("http://t/api/session-staff-contributions/" + id, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }), { params: { id } } as any);
const reverse = (id: string, b: unknown) => reverseRaw(new Request("http://t/api/session-staff-contributions/" + id + "/reverse", J(b)), { params: { id } } as any);

const WRITER = [PERMISSIONS.TREATMENT_WRITE, PERMISSIONS.TREATMENT_READ];
async function mkEmployee(over: { userId?: string; title?: string; status?: string; branchId?: string } = {}) {
  return prisma.employee.create({ data: { code: uniq("NV"), fullName: "NV " + uniq("x"), title: over.title ?? "KTV", status: (over.status as any) ?? "ACTIVE", isActive: (over.status ?? "ACTIVE") === "ACTIVE", userId: over.userId ?? null, branchId: over.branchId ?? null } });
}
async function mkSession(frozen = false) {
  const cust = await prisma.customer.create({ data: { code: uniq("KH"), fullName: "KH" } });
  return prisma.treatmentSession.create({ data: { code: uniq("SS"), customerId: cust.id, sessionNumber: 1, status: "IN_PROGRESS", ...(frozen ? { executionFrozenAt: new Date() } : {}) } });
}
async function mkItem(sessionId: string) {
  const svc = await prisma.service.create({ data: { code: uniq("DV"), name: "DV " + uniq("s"), standardPrice: 0 } });
  const item = await prisma.sessionExecutionItem.create({ data: { sessionId, serviceId: svc.id, sortOrder: 0 } });
  return { svc, item };
}
async function mkAttendance(employeeId: string, from: string, to: string | null, branchId?: string) {
  return prisma.attendanceRecord.create({ data: { employeeId, workDate: parseVnLocal(from.slice(0, 10)), checkInAt: parseVnLocal(from), checkOutAt: to ? parseVnLocal(to) : null, status: to ? "COMPLETED" : "OPEN", branchId: branchId ?? null } });
}

describe("HR-PH3 · Contribution basic + integrity", () => {
  beforeAll(async () => { await prisma.$executeRawUnsafe("TRUNCATE auth_throttles RESTART IDENTITY CASCADE").catch(() => {}); });
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect().catch(() => {}); });

  it("A+E · session-level contribution + role snapshot", async () => {
    await login((await makeUser(WRITER)).email);
    const s = await mkSession(); const emp = await mkEmployee({ title: "Master" });
    const r = await D(await create({ treatmentSessionId: s.id, employeeId: emp.id, contributionTypeCode: "MASTER_SUPERVISION" }));
    expect(r.sessionExecutionItemId).toBeNull();
    expect(r.employeeNameSnapshot).toBe(emp.fullName);
    expect(r.employeeRoleSnapshot).toBe("Master");
    expect(r.status).toBe("DRAFT");
  });
  it("B+H · service-item contribution + minutes từ timestamps", async () => {
    await login((await makeUser(WRITER)).email);
    const s = await mkSession(); const { item } = await mkItem(s.id); const emp = await mkEmployee();
    const r = await D(await create({ treatmentSessionId: s.id, sessionExecutionItemId: item.id, employeeId: emp.id, contributionTypeCode: "PRIMARY_OPERATOR", startedAt: "2026-08-20T08:00", endedAt: "2026-08-20T08:45" }));
    expect(r.sessionExecutionItemId).toBe(item.id);
    expect(r.actualMinutes).toBe(45);
    expect(r.serviceNameSnapshot).toBeTruthy();
  });
  it("C · step/phase contribution (serviceStepKey)", async () => {
    await login((await makeUser(WRITER)).email);
    const s = await mkSession(); const { item } = await mkItem(s.id); const emp = await mkEmployee();
    const r = await D(await create({ treatmentSessionId: s.id, sessionExecutionItemId: item.id, serviceStepKey: "LASER", employeeId: emp.id, contributionTypeCode: "TECHNOLOGY_OPERATOR" }));
    expect(r.serviceStepKey).toBe("LASER");
  });
  it("D · nhiều nhân sự cùng 1 dịch vụ + weight", async () => {
    await login((await makeUser(WRITER)).email);
    const s = await mkSession(); const { item } = await mkItem(s.id);
    const a = await mkEmployee(); const b = await mkEmployee(); const c = await mkEmployee();
    await create({ treatmentSessionId: s.id, sessionExecutionItemId: item.id, employeeId: a.id, contributionTypeCode: "MASTER_SUPERVISION", weight: 0.25 });
    await create({ treatmentSessionId: s.id, sessionExecutionItemId: item.id, employeeId: b.id, contributionTypeCode: "PRIMARY_OPERATOR", weight: 0.6 });
    await create({ treatmentSessionId: s.id, sessionExecutionItemId: item.id, employeeId: c.id, contributionTypeCode: "ASSISTANT", weight: 0.15 });
    expect(await prisma.sessionStaffContribution.count({ where: { sessionExecutionItemId: item.id } })).toBe(3);
  });
  it("F+G · đổi tên nhân sự/dịch vụ SAU không đổi snapshot lịch sử", async () => {
    await login((await makeUser(WRITER)).email);
    const s = await mkSession(); const { svc, item } = await mkItem(s.id); const emp = await mkEmployee();
    const r = await D(await create({ treatmentSessionId: s.id, sessionExecutionItemId: item.id, employeeId: emp.id, contributionTypeCode: "PRIMARY_OPERATOR" }));
    await prisma.employee.update({ where: { id: emp.id }, data: { fullName: "Tên MỚI", title: "Chức MỚI" } });
    await prisma.service.update({ where: { id: svc.id }, data: { name: "Dịch vụ MỚI" } });
    const after = await prisma.sessionStaffContribution.findUnique({ where: { id: r.id } });
    expect(after?.employeeNameSnapshot).toBe(emp.fullName); // KHÔNG đổi
    expect(after?.serviceNameSnapshot).not.toBe("Dịch vụ MỚI");
  });
  it("I · manual minutes (không có timestamps)", async () => {
    await login((await makeUser(WRITER)).email);
    const s = await mkSession(); const emp = await mkEmployee();
    const r = await D(await create({ treatmentSessionId: s.id, employeeId: emp.id, contributionTypeCode: "OTHER", actualMinutes: 30 }));
    expect(r.actualMinutes).toBe(30);
  });
  it("J · item không thuộc buổi → 422", async () => {
    await login((await makeUser(WRITER)).email);
    const s1 = await mkSession(); const s2 = await mkSession(); const { item } = await mkItem(s2.id); const emp = await mkEmployee();
    expect((await create({ treatmentSessionId: s1.id, sessionExecutionItemId: item.id, employeeId: emp.id, contributionTypeCode: "OTHER" })).status).toBe(422);
  });
  it("K · end trước start → 422", async () => {
    await login((await makeUser(WRITER)).email);
    const s = await mkSession(); const emp = await mkEmployee();
    expect((await create({ treatmentSessionId: s.id, employeeId: emp.id, contributionTypeCode: "OTHER", startedAt: "2026-08-20T10:00", endedAt: "2026-08-20T09:00" })).status).toBe(422);
  });
  it("L · nhân sự không tồn tại → 422", async () => {
    await login((await makeUser(WRITER)).email);
    const s = await mkSession();
    expect((await create({ treatmentSessionId: s.id, employeeId: "khong-co", contributionTypeCode: "OTHER" })).status).toBe(422);
  });
  it("M+N · idempotencyKey chống trùng; không key → tạo nhiều", async () => {
    await login((await makeUser(WRITER)).email);
    const s = await mkSession(); const emp = await mkEmployee();
    const k = uniq("idem");
    const a = await D(await create({ treatmentSessionId: s.id, employeeId: emp.id, contributionTypeCode: "OTHER", idempotencyKey: k }));
    const b = await D(await create({ treatmentSessionId: s.id, employeeId: emp.id, contributionTypeCode: "OTHER", idempotencyKey: k }));
    expect(a.id).toBe(b.id);
    await create({ treatmentSessionId: s.id, employeeId: emp.id, contributionTypeCode: "OTHER" });
    await create({ treatmentSessionId: s.id, employeeId: emp.id, contributionTypeCode: "OTHER" });
    expect(await prisma.sessionStaffContribution.count({ where: { treatmentSessionId: s.id } })).toBe(3);
  });
  it("O · nhân sự RESIGNED vẫn ghi được (bằng chứng lịch sử)", async () => {
    await login((await makeUser(WRITER)).email);
    const s = await mkSession(); const emp = await mkEmployee({ status: "RESIGNED" });
    expect((await create({ treatmentSessionId: s.id, employeeId: emp.id, contributionTypeCode: "OTHER" })).status).toBe(201);
  });
});

describe("HR-PH3 · Attendance cross-check", () => {
  beforeAll(async () => { await prisma.$executeRawUnsafe("TRUNCATE auth_throttles RESTART IDENTITY CASCADE").catch(() => {}); });
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect().catch(() => {}); });
  const flags = (r: any) => (r.crossCheckFlags ?? []).map((f: any) => f.code);

  it("R · trong ca chấm công → không cờ NO_ATTENDANCE", async () => {
    await login((await makeUser(WRITER)).email);
    const s = await mkSession(); const emp = await mkEmployee();
    await mkAttendance(emp.id, "2026-08-20T08:00", "2026-08-20T17:00");
    const r = await D(await create({ treatmentSessionId: s.id, employeeId: emp.id, contributionTypeCode: "PRIMARY_OPERATOR", startedAt: "2026-08-20T09:00", endedAt: "2026-08-20T09:30" }));
    expect(flags(r)).not.toContain("NO_ATTENDANCE");
  });
  it("S · không chấm công → cờ NO_ATTENDANCE", async () => {
    await login((await makeUser(WRITER)).email);
    const s = await mkSession(); const emp = await mkEmployee();
    const r = await D(await create({ treatmentSessionId: s.id, employeeId: emp.id, contributionTypeCode: "PRIMARY_OPERATOR", startedAt: "2026-08-20T09:00", endedAt: "2026-08-20T09:30" }));
    expect(flags(r)).toContain("NO_ATTENDANCE");
  });
  it("T · nghỉ đã duyệt → cờ ON_APPROVED_LEAVE", async () => {
    await login((await makeUser(WRITER)).email);
    const s = await mkSession(); const emp = await mkEmployee();
    await prisma.employeeLeave.create({ data: { employeeId: emp.id, type: "ANNUAL", fromAt: parseVnLocal("2026-08-20"), toAt: parseVnLocal("2026-08-20T23:59"), status: "APPROVED" } });
    const r = await D(await create({ treatmentSessionId: s.id, employeeId: emp.id, contributionTypeCode: "PRIMARY_OPERATOR", startedAt: "2026-08-20T09:00", endedAt: "2026-08-20T09:30" }));
    expect(flags(r)).toContain("ON_APPROVED_LEAVE");
  });
  it("U · có chấm công nhưng không ca → cờ NO_SHIFT (INFO)", async () => {
    await login((await makeUser(WRITER)).email);
    const s = await mkSession(); const emp = await mkEmployee();
    await mkAttendance(emp.id, "2026-08-20T08:00", "2026-08-20T17:00");
    const r = await D(await create({ treatmentSessionId: s.id, employeeId: emp.id, contributionTypeCode: "PRIMARY_OPERATOR", startedAt: "2026-08-20T09:00", endedAt: "2026-08-20T09:30" }));
    expect(flags(r)).toContain("NO_SHIFT");
  });
  it("P+V · branch mismatch → cờ BRANCH_MISMATCH", async () => {
    await login((await makeUser(WRITER)).email);
    const brA = await prisma.branch.create({ data: { code: uniq("CN"), name: "A" } });
    const brB = await prisma.branch.create({ data: { code: uniq("CN"), name: "B" } });
    const s = await mkSession(); const emp = await mkEmployee();
    await mkAttendance(emp.id, "2026-08-20T08:00", "2026-08-20T17:00", brA.id);
    const r = await D(await create({ treatmentSessionId: s.id, employeeId: emp.id, contributionTypeCode: "PRIMARY_OPERATOR", branchId: brB.id, startedAt: "2026-08-20T09:00", endedAt: "2026-08-20T09:30" }));
    expect(flags(r)).toContain("BRANCH_MISMATCH");
  });
  it("Q+X · trùng thời gian + hai chi nhánh → cờ OVERLAP + TWO_BRANCHES", async () => {
    await login((await makeUser(WRITER)).email);
    const brA = await prisma.branch.create({ data: { code: uniq("CN"), name: "A" } });
    const brB = await prisma.branch.create({ data: { code: uniq("CN"), name: "B" } });
    const s = await mkSession(); const emp = await mkEmployee();
    await create({ treatmentSessionId: s.id, employeeId: emp.id, contributionTypeCode: "PRIMARY_OPERATOR", branchId: brA.id, startedAt: "2026-08-20T09:00", endedAt: "2026-08-20T10:00" });
    const r2 = await D(await create({ treatmentSessionId: s.id, employeeId: emp.id, contributionTypeCode: "ASSISTANT", branchId: brB.id, startedAt: "2026-08-20T09:30", endedAt: "2026-08-20T10:30" }));
    expect(flags(r2)).toContain("OVERLAP_CONTRIBUTION");
    expect(flags(r2)).toContain("TWO_BRANCHES_SAME_TIME");
  });
  it("W · cross-midnight contribution 23:00→00:30 = 90'", async () => {
    await login((await makeUser(WRITER)).email);
    const s = await mkSession(); const emp = await mkEmployee();
    const r = await D(await create({ treatmentSessionId: s.id, employeeId: emp.id, contributionTypeCode: "OTHER", startedAt: "2026-08-20T23:00", endedAt: "2026-08-21T00:30" }));
    expect(r.actualMinutes).toBe(90);
  });
});

describe("HR-PH3 · Freeze / reversal / RBAC", () => {
  beforeAll(async () => { await prisma.$executeRawUnsafe("TRUNCATE auth_throttles RESTART IDENTITY CASCADE").catch(() => {}); });
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect().catch(() => {}); });

  it("Y · DRAFT sửa được (buổi chưa freeze)", async () => {
    await login((await makeUser(WRITER)).email);
    const s = await mkSession(); const emp = await mkEmployee();
    const r = await D(await create({ treatmentSessionId: s.id, employeeId: emp.id, contributionTypeCode: "OTHER", actualMinutes: 20 }));
    const up = await D(await patch(r.id, { actualMinutes: 35, note: "sửa" }));
    expect(up.actualMinutes).toBe(35);
  });
  it("Z · buổi đã freeze → PATCH draft 409; tạo mới cần editCompleted", async () => {
    const s = await mkSession(true); const emp = await mkEmployee();
    // tạo contribution bằng editCompleted (frozen)
    await login((await makeUser([...WRITER, PERMISSIONS.TREATMENT_EDIT_COMPLETED])).email);
    const r = await D(await create({ treatmentSessionId: s.id, employeeId: emp.id, contributionTypeCode: "OTHER", actualMinutes: 20 }));
    expect(r.status).toBe("ACTIVE"); // frozen → ACTIVE ngay
    expect((await patch(r.id, { actualMinutes: 99 })).status).toBe(409);
    // writer KHÔNG editCompleted tạo trên buổi freeze → 403
    await login((await makeUser(WRITER)).email);
    expect((await create({ treatmentSessionId: s.id, employeeId: emp.id, contributionTypeCode: "OTHER" })).status).toBe(403);
  });
  it("AA+AB+AC+AE · reversal giữ gốc, chặn 2 lần, correction = reversal + line mới", async () => {
    await login((await makeUser(WRITER)).email);
    const s = await mkSession(); const emp = await mkEmployee();
    const r = await D(await create({ treatmentSessionId: s.id, employeeId: emp.id, contributionTypeCode: "PRIMARY_OPERATOR", actualMinutes: 45 }));
    const rev = await D(await reverse(r.id, { reason: "Gán sai vai trò" }));
    expect(rev.entryKind).toBe("REVERSAL"); expect(rev.actualMinutes).toBe(-45); expect(rev.reversalOfId).toBe(r.id);
    const orig = await prisma.sessionStaffContribution.findUnique({ where: { id: r.id } });
    expect(orig?.status).toBe("REVERSED"); expect(orig?.reversedAt).toBeTruthy(); // AE: còn tồn tại
    expect((await reverse(r.id, { reason: "lại" })).status).toBe(409); // AB double
    // AC correction: tạo line mới đúng
    const fixed = await D(await create({ treatmentSessionId: s.id, employeeId: emp.id, contributionTypeCode: "ASSISTANT", actualMinutes: 30 }));
    expect(fixed.entryKind).toBe("CONTRIBUTION");
    // AD audit append-only
    expect(await prisma.auditLog.count({ where: { entityId: r.id, action: "SESSION_STAFF_CONTRIBUTION_REVERSED" } })).toBe(1);
  });
  it("AF+AG+AK+AL · RBAC create", async () => {
    const s = await mkSession(); const emp = await mkEmployee();
    // AF: không treatment.write → 403
    await login((await makeUser([PERMISSIONS.TREATMENT_READ])).email);
    expect((await create({ treatmentSessionId: s.id, employeeId: emp.id, contributionTypeCode: "OTHER" })).status).toBe(403);
    // AK: finance.read đơn lẻ → 403
    await login((await makeUser([PERMISSIONS.FINANCE_READ])).email);
    expect((await create({ treatmentSessionId: s.id, employeeId: emp.id, contributionTypeCode: "OTHER" })).status).toBe(403);
    // AG+AL: treatment.write (không payroll) → 201
    await login((await makeUser([PERMISSIONS.TREATMENT_WRITE])).email);
    expect((await create({ treatmentSessionId: s.id, employeeId: emp.id, contributionTypeCode: "OTHER" })).status).toBe(201);
  });
  it("AH · buổi freeze cần editCompleted (403→ok)", async () => {
    const s = await mkSession(true); const emp = await mkEmployee();
    await login((await makeUser([PERMISSIONS.TREATMENT_WRITE])).email);
    expect((await create({ treatmentSessionId: s.id, employeeId: emp.id, contributionTypeCode: "OTHER" })).status).toBe(403);
    await login((await makeUser([PERMISSIONS.TREATMENT_WRITE, PERMISSIONS.TREATMENT_EDIT_COMPLETED])).email);
    expect((await create({ treatmentSessionId: s.id, employeeId: emp.id, contributionTypeCode: "OTHER" })).status).toBe(201);
  });
  it("AI+AJ · self xem của mình; self KHÔNG sửa của người khác", async () => {
    // Tạo dữ liệu bằng writer
    await login((await makeUser(WRITER)).email);
    const s = await mkSession();
    const u = await makeUser([]); const empSelf = await mkEmployee({ userId: u.userId });
    const empOther = await mkEmployee();
    const own = await D(await create({ treatmentSessionId: s.id, employeeId: empSelf.id, contributionTypeCode: "OTHER" }));
    const other = await D(await create({ treatmentSessionId: s.id, employeeId: empOther.id, contributionTypeCode: "OTHER" }));
    // self (không treatment.read/write) → list chỉ của mình
    await login(u.email);
    const rows = await D(await list());
    expect(rows.length).toBe(1); expect(rows[0].id).toBe(own.id);
    // self PATCH của người khác → 403 (không treatment.write)
    expect((await patch(other.id, { note: "hack" })).status).toBe(403);
  });
});
