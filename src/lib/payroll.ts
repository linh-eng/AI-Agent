// =============================================================================
// HR-PH6 — PAYROLL ENGINE (Bảng lương). Deterministic, append-only, immutable
// khi DUYỆT. GỘP CompensationEvent (HR-PH5) + lương cơ bản + phụ cấp → gộp → trừ
// khấu trừ cấu hình → thực nhận.
//
// NGUYÊN TẮC CỨNG:
//  * KHÔNG hard-code PIT/BHXH — dùng PayrollComponentRule (chủ DN tự khai).
//  * Thu nhập = CompensationEvent status ELIGIBLE, eventType ≠ REVERSAL (reversal
//    đã net ở tầng event: bản gốc → REVERSED (loại), dòng REVERSAL (loại)).
//  * Lương cơ bản (EmployeeBaseSalary) TÁCH khỏi EmployeeRoleFee (costing-only).
//  * Tính lại (kỳ chưa duyệt) = supersede bản CURRENT (version++). DUYỆT → bất biến.
// =============================================================================
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { sequentialCode, auditLog } from "./clinic";
import { parseVnLocal } from "./timezone";
import type { SessionPayload } from "./auth";

const now = () => new Date();
const num = (d: any): number => (d == null ? 0 : Number(d));
const actor = (s: SessionPayload) => s.name ?? s.email ?? null;

export class PayrollError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

export async function nextPayrollCode(): Promise<string> {
  const count = await prisma.payrollPeriod.count();
  return sequentialCode("PR", count);
}

function bounds(period: { startDate: Date; endDate: Date }) {
  const s = period.startDate, e = period.endDate;
  const ds = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  return { startInstant: parseVnLocal(`${ds(s)}T00:00:00`), endInstant: new Date(parseVnLocal(`${ds(e)}T23:59:59`).getTime() + 999) };
}

/** Lương cơ bản hiện hành của nhân sự tại thời điểm (hiệu lực ngày). */
export async function resolveBaseSalary(employeeId: string, at: Date): Promise<number> {
  const rows = await prisma.employeeBaseSalary.findMany({ where: { employeeId, isActive: true }, orderBy: { effectiveFrom: "desc" } });
  for (const r of rows) {
    if (r.effectiveFrom.getTime() > at.getTime()) continue;
    if (r.effectiveTo && r.effectiveTo.getTime() <= at.getTime()) continue;
    return num(r.amount);
  }
  return 0;
}

/** Cấu hình phụ cấp/khấu trừ áp cho nhân sự (COMPANY + ROLE khớp + EMPLOYEE khớp). */
async function resolveComponents(emp: { id: string; roles: string[] }) {
  const rules = await prisma.payrollComponentRule.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { code: "asc" }] });
  return rules.filter((r) => {
    if (r.scope === "COMPANY") return true;
    if (r.scope === "ROLE") return !!r.scopeRef && emp.roles.includes(r.scopeRef);
    if (r.scope === "EMPLOYEE") return r.scopeRef === emp.id;
    return false;
  });
}

/** Thu nhập từ CompensationEvent trong kỳ (net; loại REVERSAL + bản đã REVERSED). */
async function earningsForPeriod(employeeId: string, b: ReturnType<typeof bounds>) {
  const rows = await prisma.compensationEvent.findMany({
    where: { employeeId, status: "ELIGIBLE", eventType: { in: ["SALES_COMMISSION", "TREATMENT_INCENTIVE", "KPI_BONUS", "ADJUSTMENT"] }, eventDate: { gte: b.startInstant, lte: b.endInstant } },
    select: { id: true, eventType: true, amount: true },
  });
  const out = { commission: 0, incentive: 0, bonus: 0, adjustment: 0, ids: [] as string[] };
  for (const r of rows) {
    out.ids.push(r.id);
    const a = num(r.amount);
    if (r.eventType === "SALES_COMMISSION") out.commission += a;
    else if (r.eventType === "TREATMENT_INCENTIVE") out.incentive += a;
    else if (r.eventType === "KPI_BONUS") out.bonus += a;
    else out.adjustment += a;
  }
  return out;
}

/** Tính 1 phiếu lương (thuần, không ghi DB) — trả breakdown đầy đủ. */
export async function computePayrollLine(emp: { id: string; fullName: string; roles: string[]; branchId: string | null }, period: { startDate: Date; endDate: Date }) {
  const b = bounds(period);
  const at = new Date(parseVnLocal(`${period.endDate.getUTCFullYear()}-${String(period.endDate.getUTCMonth() + 1).padStart(2, "0")}-${String(period.endDate.getUTCDate()).padStart(2, "0")}T23:59:59`).getTime());
  const base = await resolveBaseSalary(emp.id, at);
  const earn = await earningsForPeriod(emp.id, b);
  const components = await resolveComponents(emp);

  // Phụ cấp (EARNING) trước → có lương gộp → khấu trừ (DEDUCTION).
  const earnLines: any[] = [];
  let allowanceTotal = 0;
  for (const c of components.filter((x) => x.kind === "EARNING")) {
    const amt = c.calcType === "FIXED" ? num(c.value) : c.calcType === "PERCENT_BASE" ? Math.round((num(c.value) / 100) * base) : 0; // PERCENT_GROSS phụ cấp hiếm → tính sau nếu cần
    allowanceTotal += amt;
    earnLines.push({ code: c.code, name: c.name, kind: "EARNING", calcType: c.calcType, value: num(c.value), amount: amt });
  }
  const grossPay = base + allowanceTotal + earn.commission + earn.incentive + earn.bonus + earn.adjustment;

  const dedLines: any[] = [];
  let deductionTotal = 0;
  for (const c of components.filter((x) => x.kind === "DEDUCTION")) {
    const amt = c.calcType === "FIXED" ? num(c.value) : c.calcType === "PERCENT_BASE" ? Math.round((num(c.value) / 100) * base) : Math.round((num(c.value) / 100) * grossPay);
    deductionTotal += amt;
    dedLines.push({ code: c.code, name: c.name, kind: "DEDUCTION", calcType: c.calcType, value: num(c.value), amount: amt });
  }
  const netPay = grossPay - deductionTotal;

  return {
    baseSalary: base, earningsCommission: earn.commission, earningsIncentive: earn.incentive, earningsBonus: earn.bonus, earningsAdjustment: earn.adjustment,
    allowanceTotal, grossPay, deductionTotal, netPay,
    breakdown: {
      base, commission: earn.commission, incentive: earn.incentive, bonus: earn.bonus, adjustment: earn.adjustment,
      allowances: earnLines, deductions: dedLines, grossPay, deductionTotal, netPay, eventIds: earn.ids,
      periodStart: b.startInstant.toISOString(), periodEnd: b.endInstant.toISOString(),
    },
  };
}

async function candidateEmployees(b: ReturnType<typeof bounds>, branchId: string | null) {
  const [active, withEvents, withBase] = await Promise.all([
    prisma.employee.findMany({ where: { status: "ACTIVE", ...(branchId ? { branchId } : {}) }, select: { id: true, fullName: true, roles: true, branchId: true } }),
    prisma.compensationEvent.findMany({ where: { status: "ELIGIBLE", eventDate: { gte: b.startInstant, lte: b.endInstant } }, select: { employeeId: true }, distinct: ["employeeId"] }),
    prisma.employeeBaseSalary.findMany({ where: { isActive: true }, select: { employeeId: true }, distinct: ["employeeId"] }),
  ]);
  const ids = new Set<string>(active.map((e) => e.id));
  withEvents.forEach((x) => ids.add(x.employeeId));
  withBase.forEach((x) => ids.add(x.employeeId));
  return prisma.employee.findMany({ where: { id: { in: Array.from(ids) }, ...(branchId ? { branchId } : {}) }, select: { id: true, fullName: true, roles: true, branchId: true } });
}

/** Tính kỳ lương → phiếu lương (supersede bản CURRENT; append-only). */
export async function calculatePayrollPeriod(session: SessionPayload, periodId: string): Promise<{ employees: number; version: number }> {
  const period = await prisma.payrollPeriod.findUnique({ where: { id: periodId } });
  if (!period) throw new PayrollError("Không tìm thấy kỳ lương", 404);
  if (period.status === "APPROVED" || period.status === "PAID" || period.status === "LOCKED") throw new PayrollError("Kỳ lương đã DUYỆT — không thể tính lại (bất biến).", 409);

  const b = bounds(period);
  const emps = await candidateEmployees(b, period.branchId);
  const prevMax = await prisma.employeePayrollLine.aggregate({ where: { payrollPeriodId: periodId }, _max: { version: true } });
  const version = (prevMax._max.version ?? 0) + 1;

  await prisma.$transaction(async (tx) => {
    await tx.employeePayrollLine.updateMany({ where: { payrollPeriodId: periodId, status: "CURRENT" }, data: { status: "SUPERSEDED" } });
    for (const emp of emps) {
      const line = await computePayrollLine(emp, period);
      await tx.employeePayrollLine.create({ data: {
        payrollPeriodId: periodId, employeeId: emp.id,
        baseSalary: new Prisma.Decimal(line.baseSalary), earningsCommission: new Prisma.Decimal(line.earningsCommission),
        earningsIncentive: new Prisma.Decimal(line.earningsIncentive), earningsBonus: new Prisma.Decimal(line.earningsBonus),
        earningsAdjustment: new Prisma.Decimal(line.earningsAdjustment), allowanceTotal: new Prisma.Decimal(line.allowanceTotal),
        grossPay: new Prisma.Decimal(line.grossPay), deductionTotal: new Prisma.Decimal(line.deductionTotal), netPay: new Prisma.Decimal(line.netPay),
        breakdown: line.breakdown as any, employeeSnapshot: emp.fullName, branchSnapshot: emp.branchId ?? null,
        version, status: "CURRENT", createdBy: actor(session),
      } });
    }
    await tx.payrollPeriod.update({ where: { id: periodId }, data: { status: "CALCULATED", calculatedAt: now(), calculatedBy: actor(session) } });
  });
  await auditLog({ userId: session.userId, action: "PAYROLL_PERIOD_CALCULATED", entityType: "PayrollPeriod", entityId: periodId, changes: { version, employees: emps.length } });
  return { employees: emps.length, version };
}

/** Duyệt kỳ → khóa phiếu lương (bất biến). */
export async function approvePayrollPeriod(session: SessionPayload, periodId: string): Promise<void> {
  const period = await prisma.payrollPeriod.findUnique({ where: { id: periodId } });
  if (!period) throw new PayrollError("Không tìm thấy kỳ lương", 404);
  if (period.status === "DRAFT") throw new PayrollError("Cần TÍNH kỳ trước khi duyệt", 409);
  if (period.status !== "CALCULATED") throw new PayrollError("Chỉ duyệt kỳ ở trạng thái ĐÃ TÍNH", 409);
  await prisma.$transaction(async (tx) => {
    await tx.employeePayrollLine.updateMany({ where: { payrollPeriodId: periodId, status: "CURRENT" }, data: { lockedAt: now() } });
    await tx.payrollPeriod.update({ where: { id: periodId }, data: { status: "APPROVED", approvedAt: now(), approvedBy: actor(session) } });
  });
  await auditLog({ userId: session.userId, action: "PAYROLL_PERIOD_APPROVED", entityType: "PayrollPeriod", entityId: periodId, changes: {} });
}

/** Đánh dấu ĐÃ CHI (không tạo giao dịch ngân hàng — chỉ trạng thái). */
export async function markPayrollPaid(session: SessionPayload, periodId: string): Promise<void> {
  const period = await prisma.payrollPeriod.findUnique({ where: { id: periodId } });
  if (!period) throw new PayrollError("Không tìm thấy kỳ lương", 404);
  if (period.status !== "APPROVED") throw new PayrollError("Chỉ chi kỳ đã DUYỆT", 409);
  await prisma.payrollPeriod.update({ where: { id: periodId }, data: { status: "PAID", paidAt: now(), paidBy: actor(session) } });
  await auditLog({ userId: session.userId, action: "PAYROLL_PERIOD_PAID", entityType: "PayrollPeriod", entityId: periodId, changes: {} });
}
