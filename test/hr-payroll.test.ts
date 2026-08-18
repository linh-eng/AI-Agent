// =============================================================================
// HR-PH6 — Payroll (Bảng lương). Chứng minh A–P.
//   Base salary A–B · Earnings aggregation C–E · Allowance/Deduction F–H ·
//   Lifecycle I–L · Self/RBAC M–P.
// GỘP CompensationEvent + lương cơ bản + phụ cấp → gộp → khấu trừ cấu hình →
// thực nhận · reversal loại · supersede idempotent · duyệt bất biến · self FK.
// KHÔNG hard-code PIT/BHXH · KHÔNG dùng EmployeeRoleFee · KHÔNG finance.read.
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
import { POST as periodCreate, GET as periodList } from "@/app/api/payroll-periods/route";
import { GET as periodGet } from "@/app/api/payroll-periods/[id]/route";
import { POST as calcRaw } from "@/app/api/payroll-periods/[id]/calculate/route";
import { POST as approveRaw } from "@/app/api/payroll-periods/[id]/approve/route";
import { POST as payRaw } from "@/app/api/payroll-periods/[id]/pay/route";
import { POST as baseCreate, GET as baseList } from "@/app/api/employee-base-salaries/route";
import { POST as compCreate } from "@/app/api/payroll-component-rules/route";
import { GET as linesList } from "@/app/api/employee-payroll-lines/route";

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
  await staffLogin(new Request("http://t/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `10.77.0.${++ip}` }, body: JSON.stringify({ email, password: "matkhau123" }) }), {} as any);
}
const J = (b: unknown) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
const createPeriod = (b: unknown) => periodCreate(new Request("http://t/api/payroll-periods", J(b)), {} as any);
const getPeriod = (id: string) => periodGet(new Request("http://t/api/payroll-periods/" + id), { params: { id } } as any);
const calc = (id: string) => calcRaw(new Request("http://t/x", { method: "POST" }), { params: { id } } as any);
const approve = (id: string) => approveRaw(new Request("http://t/x", { method: "POST" }), { params: { id } } as any);
const pay = (id: string) => payRaw(new Request("http://t/x", { method: "POST" }), { params: { id } } as any);
const addBase = (b: unknown) => baseCreate(new Request("http://t/api/employee-base-salaries", J(b)), {} as any);
const listBase = (qs = "") => baseList(new Request("http://t/api/employee-base-salaries" + qs), {} as any);
const addComp = (b: unknown) => compCreate(new Request("http://t/api/payroll-component-rules", J(b)), {} as any);
const lines = (qs = "") => linesList(new Request("http://t/api/employee-payroll-lines" + qs), {} as any);

const PW = [PERMISSIONS.PAYROLL_READ, PERMISSIONS.PAYROLL_WRITE, PERMISSIONS.PAYROLL_APPROVE];
async function boot() { const m = await makeUser(PW); await login(m.email); return m; }
async function mkEmp(over: { roles?: string[]; branchId?: string; fullName?: string } = {}) {
  return prisma.employee.create({ data: { code: uniq("NV"), fullName: over.fullName ?? "NV " + uniq("x"), status: "ACTIVE", isActive: true, roles: over.roles ?? [], branchId: over.branchId ?? null } });
}
async function mkEvent(employeeId: string, type: string, amount: number, over: { status?: string; date?: string } = {}) {
  return prisma.compensationEvent.create({ data: {
    employeeId, eventType: type as any, sourceType: "PAYMENT", sourceId: uniq("s"), policyVersionId: uniq("pv"), ruleId: uniq("r"),
    eventDate: parseVnLocal(over.date ?? "2026-01-15T10:00"), amount: amount as any, calculationSnapshot: {} as any,
    status: (over.status as any) ?? "ELIGIBLE", idempotencyKey: uniq("k"),
  } });
}
async function newPeriod() { return (await D(await createPeriod({ name: "Kỳ 01/2026", startDate: "2026-01-01", endDate: "2026-01-31" }))) as any; }
async function lineOf(periodId: string, employeeId: string) {
  return prisma.employeePayrollLine.findFirst({ where: { payrollPeriodId: periodId, employeeId, status: "CURRENT" } });
}

describe("HR-PH6 · Base salary + earnings (A–E)", () => {
  beforeAll(async () => { await prisma.$executeRawUnsafe("TRUNCATE auth_throttles RESTART IDENTITY CASCADE").catch(() => {}); });
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect().catch(() => {}); });

  it("A+B: lương cơ bản versioned — bản hiệu lực theo ngày kỳ", async () => {
    await boot();
    const emp = await mkEmp();
    await addBase({ employeeId: emp.id, amount: 8_000_000, effectiveFrom: "2025-01-01", effectiveTo: "2026-01-01" });
    await addBase({ employeeId: emp.id, amount: 10_000_000, effectiveFrom: "2026-01-01" });
    const p = await newPeriod();
    await calc(p.id);
    expect(Number((await lineOf(p.id, emp.id))!.baseSalary)).toBe(10_000_000); // bản mới hiệu lực trong kỳ
  });

  it("C+D: gộp thu nhập từ CompensationEvent (commission/incentive/bonus)", async () => {
    await boot();
    const emp = await mkEmp();
    await addBase({ employeeId: emp.id, amount: 10_000_000, effectiveFrom: "2026-01-01" });
    await mkEvent(emp.id, "SALES_COMMISSION", 150_000);
    await mkEvent(emp.id, "TREATMENT_INCENTIVE", 200_000);
    await mkEvent(emp.id, "KPI_BONUS", 1_000_000);
    const p = await newPeriod();
    await calc(p.id);
    const l = await lineOf(p.id, emp.id);
    expect(Number(l!.earningsCommission)).toBe(150_000);
    expect(Number(l!.earningsIncentive)).toBe(200_000);
    expect(Number(l!.earningsBonus)).toBe(1_000_000);
    expect(Number(l!.grossPay)).toBe(11_350_000); // 10tr + 150k + 200k + 1tr
    expect(Number(l!.netPay)).toBe(11_350_000); // chưa có khấu trừ
  });

  it("E: event ĐÃ REVERSED / dòng REVERSAL KHÔNG tính vào thu nhập (net)", async () => {
    await boot();
    const emp = await mkEmp();
    await addBase({ employeeId: emp.id, amount: 10_000_000, effectiveFrom: "2026-01-01" });
    await mkEvent(emp.id, "SALES_COMMISSION", 150_000, { status: "REVERSED" }); // bản gốc đã hoàn tác
    await mkEvent(emp.id, "REVERSAL", -150_000, { status: "ELIGIBLE" }); // dòng bù
    await mkEvent(emp.id, "TREATMENT_INCENTIVE", 200_000); // hợp lệ
    const p = await newPeriod();
    await calc(p.id);
    const l = await lineOf(p.id, emp.id);
    expect(Number(l!.earningsCommission)).toBe(0); // reversed loại, reversal không cộng
    expect(Number(l!.earningsIncentive)).toBe(200_000);
    expect(Number(l!.grossPay)).toBe(10_200_000);
  });
});

describe("HR-PH6 · Allowance/Deduction (F–H)", () => {
  beforeAll(async () => { await prisma.$executeRawUnsafe("TRUNCATE auth_throttles RESTART IDENTITY CASCADE").catch(() => {}); });
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect().catch(() => {}); });

  it("F: phụ cấp FIXED cộng vào lương gộp", async () => {
    await boot();
    const emp = await mkEmp();
    await addBase({ employeeId: emp.id, amount: 10_000_000, effectiveFrom: "2026-01-01" });
    await addComp({ code: "PC-ANTRUA", name: "Phụ cấp ăn trưa", kind: "EARNING", calcType: "FIXED", value: 500_000, scope: "COMPANY" });
    const p = await newPeriod();
    await calc(p.id);
    const l = await lineOf(p.id, emp.id);
    expect(Number(l!.allowanceTotal)).toBe(500_000);
    expect(Number(l!.grossPay)).toBe(10_500_000);
  });

  it("G: khấu trừ % lương cơ bản + % lương gộp (chủ DN tự khai, KHÔNG hard-code)", async () => {
    await boot();
    const emp = await mkEmp();
    await addBase({ employeeId: emp.id, amount: 10_000_000, effectiveFrom: "2026-01-01" });
    await addComp({ code: "BHXH", name: "BHXH (khai tay)", kind: "DEDUCTION", calcType: "PERCENT_BASE", value: 10.5, scope: "COMPANY" }); // 10.5% × 10tr = 1.05tr
    await addComp({ code: "TAM-UNG", name: "Tạm ứng", kind: "DEDUCTION", calcType: "FIXED", value: 200_000, scope: "COMPANY" });
    const p = await newPeriod();
    await calc(p.id);
    const l = await lineOf(p.id, emp.id);
    expect(Number(l!.deductionTotal)).toBe(1_250_000); // 1.05tr + 200k
    expect(Number(l!.netPay)).toBe(8_750_000); // 10tr − 1.25tr
  });

  it("H: khấu trừ theo scope ROLE chỉ áp cho nhân sự có vai trò", async () => {
    await boot();
    const withRole = await mkEmp({ roles: ["KTV"] });
    const without = await mkEmp({ roles: ["LT"] });
    await addBase({ employeeId: withRole.id, amount: 10_000_000, effectiveFrom: "2026-01-01" });
    await addBase({ employeeId: without.id, amount: 10_000_000, effectiveFrom: "2026-01-01" });
    await addComp({ code: "PHI-KTV", name: "Phí nghề KTV", kind: "DEDUCTION", calcType: "FIXED", value: 300_000, scope: "ROLE", scopeRef: "KTV" });
    const p = await newPeriod();
    await calc(p.id);
    expect(Number((await lineOf(p.id, withRole.id))!.deductionTotal)).toBe(300_000);
    expect(Number((await lineOf(p.id, without.id))!.deductionTotal)).toBe(0);
  });
});

describe("HR-PH6 · Lifecycle (I–L)", () => {
  beforeAll(async () => { await prisma.$executeRawUnsafe("TRUNCATE auth_throttles RESTART IDENTITY CASCADE").catch(() => {}); });
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect().catch(() => {}); });

  it("I: tính kỳ → CALCULATED + tạo phiếu CURRENT", async () => {
    await boot();
    const emp = await mkEmp();
    await addBase({ employeeId: emp.id, amount: 9_000_000, effectiveFrom: "2026-01-01" });
    const p = await newPeriod();
    const res = await D(await calc(p.id));
    expect(res.employees).toBeGreaterThanOrEqual(1);
    const per = await prisma.payrollPeriod.findUnique({ where: { id: p.id } });
    expect(per!.status).toBe("CALCULATED");
  });

  it("J: tính lại — supersede bản cũ, đúng 1 CURRENT/nhân sự", async () => {
    await boot();
    const emp = await mkEmp();
    await addBase({ employeeId: emp.id, amount: 9_000_000, effectiveFrom: "2026-01-01" });
    const p = await newPeriod();
    await calc(p.id);
    await calc(p.id);
    const cur = await prisma.employeePayrollLine.count({ where: { payrollPeriodId: p.id, employeeId: emp.id, status: "CURRENT" } });
    const sup = await prisma.employeePayrollLine.count({ where: { payrollPeriodId: p.id, employeeId: emp.id, status: "SUPERSEDED" } });
    expect(cur).toBe(1);
    expect(sup).toBe(1);
  });

  it("K: DUYỆT → bất biến; tính lại sau duyệt → 409", async () => {
    await boot();
    const emp = await mkEmp();
    await addBase({ employeeId: emp.id, amount: 9_000_000, effectiveFrom: "2026-01-01" });
    const p = await newPeriod();
    await calc(p.id);
    await approve(p.id);
    const per = await prisma.payrollPeriod.findUnique({ where: { id: p.id } });
    expect(per!.status).toBe("APPROVED");
    const r = await calc(p.id);
    expect(r.status).toBe(409);
    // phiếu đã khóa (lockedAt)
    const l = await lineOf(p.id, emp.id);
    expect(l!.lockedAt).not.toBeNull();
  });

  it("L: DUYỆT → CHI (PAID); chưa tính không duyệt được", async () => {
    await boot();
    const emp = await mkEmp();
    await addBase({ employeeId: emp.id, amount: 9_000_000, effectiveFrom: "2026-01-01" });
    const p = await newPeriod();
    const early = await approve(p.id); // chưa tính
    expect(early.status).toBe(409);
    await calc(p.id);
    await approve(p.id);
    await pay(p.id);
    const per = await prisma.payrollPeriod.findUnique({ where: { id: p.id } });
    expect(per!.status).toBe("PAID");
  });
});

describe("HR-PH6 · RBAC / Self (M–P)", () => {
  beforeAll(async () => { await prisma.$executeRawUnsafe("TRUNCATE auth_throttles RESTART IDENTITY CASCADE").catch(() => {}); });
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect().catch(() => {}); });

  async function seedCalculated() {
    await boot();
    const a = await mkEmp(); const b = await mkEmp();
    await addBase({ employeeId: a.id, amount: 9_000_000, effectiveFrom: "2026-01-01" });
    await addBase({ employeeId: b.id, amount: 8_000_000, effectiveFrom: "2026-01-01" });
    const p = await newPeriod();
    await calc(p.id);
    return { a, b, p };
  }

  it("M+N: self thấy phiếu lương CỦA MÌNH, KHÔNG thấy người khác", async () => {
    const { a, b } = await seedCalculated();
    const selfUser = await makeUser([PERMISSIONS.TREATMENT_READ], { linkEmployeeId: a.id });
    await login(selfUser.email);
    const rows = await D(await lines());
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r: any) => r.employeeId === a.id)).toBe(true);
    const cross = await D(await lines(`?employeeId=${b.id}`));
    expect(cross.every((r: any) => r.employeeId === a.id)).toBe(true); // scope cứng self
  });

  it("O: finance.read ĐƠN LẺ KHÔNG cấp quyền payroll (403 read + tạo kỳ)", async () => {
    await seedCalculated();
    const fin = await makeUser([PERMISSIONS.FINANCE_READ]);
    await login(fin.email);
    expect((await lines()).status).toBe(403);
    expect((await createPeriod({ name: "x", startDate: "2026-01-01", endDate: "2026-01-31" })).status).toBe(403);
    expect((await listBase("?employeeId=abc")).status).toBe(403);
    // ẩn danh → 401
    jar.clear();
    expect((await lines()).status).toBe(401);
  });

  it("P: payroll.read xem được; payroll.approve cần cho duyệt (write không đủ)", async () => {
    const { p } = await seedCalculated();
    // reader: chỉ payroll.read
    const reader = await makeUser([PERMISSIONS.PAYROLL_READ]);
    await login(reader.email);
    expect((await lines()).status).toBe(200);
    expect((await periodList(new Request("http://t/api/payroll-periods"), {} as any)).status).toBe(200);
    // writer (không approve) → duyệt 403
    const writer = await makeUser([PERMISSIONS.PAYROLL_READ, PERMISSIONS.PAYROLL_WRITE]);
    await login(writer.email);
    expect((await approve(p.id)).status).toBe(403);
  });
});
