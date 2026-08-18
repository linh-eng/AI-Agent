// =============================================================================
// HR-PH5 — COMPENSATION ENGINE (policy · sales commission · treatment incentive ·
// KPI bonus). Tạo BẰNG CHỨNG thu nhập (append-only ledger) — KHÔNG tính lương/
// payslip/thuế/thanh toán (HR-PH6+). Deterministic, idempotent, reversal-aware.
//
// NGUYÊN TẮC CỨNG:
//  * Chỉ version PUBLISHED sinh tiền (DRAFT không sinh).
//  * Sales commission mặc định = TIỀN THỰC THU (Payment chưa hủy + Deposit đã
//    phân bổ) — KHÔNG dùng nghĩa vụ hóa đơn/giá báo giá.
//  * Treatment incentive = từ SessionStaffContribution HIỆU LỰC (ACTIVE), KHÔNG
//    từ Booking/staff dự kiến/EmployeeRoleFee/giá retail.
//  * KPI bonus CHỈ từ EmployeeKpiSnapshot đã KHÓA + VERIFIED (mặc định).
//  * Attribution = FK nhân sự tường minh (KHÔNG suy từ createdBy/receivedBy).
//  * Sửa = reversal/bút toán bù (KHÔNG hard-delete, KHÔNG sửa event lịch sử).
//  * PERCENT_ALLOCATED_REVENUE: DEFER (chưa có phân bổ doanh thu theo cấu phần).
// =============================================================================
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { sequentialCode, auditLog } from "./clinic";
import type { SessionPayload } from "./auth";

const now = () => new Date();
const num = (d: any): number => (d == null ? 0 : Number(d));
const actor = (s: SessionPayload) => s.name ?? s.email ?? null;

export class CompError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

// -----------------------------------------------------------------------------
// Mã + version
// -----------------------------------------------------------------------------
export async function nextPolicyCode(): Promise<string> {
  const count = await prisma.compensationPolicy.count();
  return sequentialCode("CP", count);
}

// -----------------------------------------------------------------------------
// Publish version — validate xung đột precedence, đông cứng snapshot, supersede.
// -----------------------------------------------------------------------------
const SCOPE_RANK: Record<string, number> = { EMPLOYEE: 3, ROLE: 2, BRANCH: 1, COMPANY: 0 };

function rangesOverlap(aFrom: Date, aTo: Date | null, bFrom: Date, bTo: Date | null): boolean {
  const aEnd = aTo ? aTo.getTime() : Infinity;
  const bEnd = bTo ? bTo.getTime() : Infinity;
  return aFrom.getTime() <= bEnd && bFrom.getTime() <= aEnd;
}

/** scope key để so trùng (cùng scopeType + cùng đối tượng). */
function scopeKey(p: { scopeType: string; branchId: string | null; roleCode: string | null; employeeId: string | null }): string {
  return `${p.scopeType}:${p.branchId ?? ""}:${p.roleCode ?? ""}:${p.employeeId ?? ""}`;
}

export async function publishPolicyVersion(session: SessionPayload, versionId: string): Promise<void> {
  const version = await prisma.compensationPolicyVersion.findUnique({
    where: { id: versionId },
    include: { policy: true, commissionRules: true, incentiveRules: true, kpiBonusRules: true },
  });
  if (!version) throw new CompError("Không tìm thấy phiên bản chính sách", 404);
  if (version.status !== "DRAFT") throw new CompError("Chỉ phát hành được phiên bản DRAFT", 409);

  // §4/§F — xung đột precedence: chính sách cùng scope key + PUBLISHED + khoảng
  // hiệu lực GIAO NHAU → từ chối (không tự chọn).
  const key = scopeKey(version.policy);
  const siblings = await prisma.compensationPolicy.findMany({
    where: {
      id: { not: version.policyId }, scopeType: version.policy.scopeType,
      branchId: version.policy.branchId, roleCode: version.policy.roleCode, employeeId: version.policy.employeeId,
    },
    include: { versions: { where: { status: "PUBLISHED" } } },
  });
  for (const sib of siblings) {
    if (scopeKey(sib) !== key) continue;
    for (const sv of sib.versions) {
      if (rangesOverlap(version.effectiveFrom, version.effectiveTo, sv.effectiveFrom, sv.effectiveTo)) {
        throw new CompError(`Xung đột chính sách cùng phạm vi (${sib.code}) — khoảng hiệu lực giao nhau. Không thể phát hành.`, 409);
      }
    }
  }

  // §30 — đông cứng snapshot rule + supersede version PUBLISHED cũ của CÙNG policy.
  const snapshot = {
    commissionRules: version.commissionRules, incentiveRules: version.incentiveRules, kpiBonusRules: version.kpiBonusRules,
    publishedAt: now().toISOString(),
  };
  await prisma.$transaction(async (tx) => {
    const prevPublished = await tx.compensationPolicyVersion.findMany({ where: { policyId: version.policyId, status: "PUBLISHED" } });
    for (const pv of prevPublished) {
      if (rangesOverlap(version.effectiveFrom, version.effectiveTo, pv.effectiveFrom, pv.effectiveTo)) {
        await tx.compensationPolicyVersion.update({ where: { id: pv.id }, data: { status: "SUPERSEDED" } });
      }
    }
    await tx.compensationPolicyVersion.update({
      where: { id: versionId },
      data: { status: "PUBLISHED", publishedAt: now(), publishedBy: actor(session), sourceSnapshot: snapshot as any, supersedesId: prevPublished[0]?.id ?? null },
    });
    await tx.compensationPolicy.update({ where: { id: version.policyId }, data: { currentVersionId: versionId } });
  });
  await auditLog({ userId: session.userId, action: "COMPENSATION_POLICY_PUBLISHED", entityType: "CompensationPolicyVersion", entityId: versionId, changes: { policyCode: version.policy.code, version: version.version } });
}

// -----------------------------------------------------------------------------
// Resolve chính sách áp dụng cho 1 nhân sự tại thời điểm — precedence
// EMPLOYEE > ROLE > BRANCH > COMPANY. Ambiguity cùng độ cụ thể → throw.
// -----------------------------------------------------------------------------
type ResolvedPolicy = { policyId: string; policyCode: string; versionId: string; version: number };

export async function resolvePolicyForEmployee(
  emp: { id: string; branchId: string | null; roles: string[] },
  at: Date,
): Promise<ResolvedPolicy | null> {
  const policies = await prisma.compensationPolicy.findMany({
    where: { status: "ACTIVE", currentVersionId: { not: null } },
    include: { versions: true },
  });
  const candidates: Array<{ rank: number; policyId: string; policyCode: string; versionId: string; version: number }> = [];
  for (const p of policies) {
    const cur = p.versions.find((v) => v.id === p.currentVersionId && v.status === "PUBLISHED");
    if (!cur) continue;
    if (cur.effectiveFrom.getTime() > at.getTime()) continue;
    if (cur.effectiveTo && cur.effectiveTo.getTime() <= at.getTime()) continue;
    let match = false;
    if (p.scopeType === "EMPLOYEE") match = p.employeeId === emp.id;
    else if (p.scopeType === "ROLE") match = !!p.roleCode && emp.roles.includes(p.roleCode);
    else if (p.scopeType === "BRANCH") match = !!p.branchId && p.branchId === emp.branchId;
    else if (p.scopeType === "COMPANY") match = true;
    if (match) candidates.push({ rank: SCOPE_RANK[p.scopeType], policyId: p.id, policyCode: p.code, versionId: cur.id, version: cur.version });
  }
  if (!candidates.length) return null;
  const maxRank = Math.max(...candidates.map((c) => c.rank));
  const top = candidates.filter((c) => c.rank === maxRank);
  if (top.length > 1) throw new CompError(`Xung đột chính sách cùng độ cụ thể cho nhân sự (${top.map((t) => t.policyCode).join(", ")}) — cần rõ ràng.`, 409);
  return top[0];
}

// -----------------------------------------------------------------------------
// Tạo event idempotent (unique idempotencyKey).
// -----------------------------------------------------------------------------
async function createEventIdem(data: Prisma.CompensationEventUncheckedCreateInput) {
  try {
    return await prisma.compensationEvent.create({ data });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const existing = await prisma.compensationEvent.findUnique({ where: { idempotencyKey: data.idempotencyKey } });
      if (existing) return existing;
    }
    throw e;
  }
}

// =============================================================================
// TREATMENT INCENTIVE — nguồn = SessionStaffContribution HIỆU LỰC.
// =============================================================================
function incentiveSpecificity(r: any): number {
  return (r.serviceId ? 8 : 0) + (r.serviceCategoryId ? 4 : 0) + (r.contributionTypeCode ? 2 : 0) + (r.employeeRoleCode ? 1 : 0);
}

async function matchIncentiveRule(versionId: string, contrib: { serviceIdSnapshot: string | null; contributionTypeCode: string; employeeRoleSnapshot: string | null }, serviceCategoryId: string | null) {
  const rules = await prisma.treatmentIncentiveRule.findMany({ where: { policyVersionId: versionId, isActive: true } });
  const matches = rules.filter((r) =>
    (r.serviceId == null || r.serviceId === contrib.serviceIdSnapshot) &&
    (r.serviceCategoryId == null || r.serviceCategoryId === serviceCategoryId) &&
    (r.contributionTypeCode == null || r.contributionTypeCode === contrib.contributionTypeCode) &&
    (r.employeeRoleCode == null || r.employeeRoleCode === contrib.employeeRoleSnapshot)
  );
  if (!matches.length) return null;
  const scored = matches.map((r) => ({ r, score: incentiveSpecificity(r) * 1000 + r.priority }));
  scored.sort((a, b) => b.score - a.score);
  if (scored.length > 1 && scored[0].score === scored[1].score) throw new CompError(`Xung đột rule incentive cùng độ ưu tiên (${scored[0].r.code}, ${scored[1].r.code}).`, 409);
  return scored[0].r;
}

/** Sinh treatment incentive cho 1 buổi (idempotent + reconcile reversal). */
export async function generateTreatmentIncentivesForSession(session: SessionPayload, sessionId: string): Promise<{ created: number; reversed: number }> {
  const ts = await prisma.treatmentSession.findUnique({ where: { id: sessionId }, select: { id: true } });
  if (!ts) throw new CompError("Không tìm thấy buổi", 404);

  const contribs = await prisma.sessionStaffContribution.findMany({
    where: { treatmentSessionId: sessionId },
    include: { employee: { select: { id: true, branchId: true, roles: true, fullName: true } } },
  });

  let created = 0, reversed = 0;
  for (const c of contribs) {
    // §Z — contribution REVERSED nhưng còn event ELIGIBLE → tạo reversal.
    if (c.status === "REVERSED" || c.entryKind === "REVERSAL") {
      const stale = await prisma.compensationEvent.findMany({ where: { eventType: "TREATMENT_INCENTIVE", sourceType: "SESSION_CONTRIBUTION", sourceLineId: c.id, status: "ELIGIBLE" } });
      for (const ev of stale) { await reverseCompensationEvent(session, ev.id, "Đóng góp đã bị hoàn tác"); reversed++; }
      continue;
    }
    if (c.status !== "ACTIVE") continue;

    const policy = await resolvePolicyForEmployee({ id: c.employee.id, branchId: c.employee.branchId, roles: c.employee.roles }, c.startedAt ?? c.createdAt);
    if (!policy) continue;
    let serviceCategoryId: string | null = null;
    if (c.serviceIdSnapshot) {
      const svc = await prisma.service.findUnique({ where: { id: c.serviceIdSnapshot }, select: { categoryId: true } });
      serviceCategoryId = svc?.categoryId ?? null;
    }
    const rule = await matchIncentiveRule(policy.versionId, c, serviceCategoryId);
    if (!rule) continue;

    // Tính tiền theo basisType.
    const minutes = c.actualMinutes ?? 0;
    if (rule.minimumMinutes != null && minutes < rule.minimumMinutes) continue;
    let base = 0; const wt = num(c.weight) || 1;
    if (rule.basisType === "FIXED_PER_SERVICE" || rule.basisType === "FIXED_PER_CONTRIBUTION") base = num(rule.fixedAmount);
    else if (rule.basisType === "PER_MINUTE") base = num(rule.perMinuteAmount) * minutes;
    else if (rule.basisType === "PERCENT_ALLOCATED_REVENUE") continue; // DEFER — không có phân bổ doanh thu
    const applyWeight = rule.weightMode === "APPLY_CONTRIBUTION_WEIGHT";
    let amount = applyWeight ? base * wt : base;
    if (rule.maxAmount != null) amount = Math.min(amount, num(rule.maxAmount));
    amount = Math.round(amount);
    if (amount <= 0) continue;

    const ev = await createEventIdem({
      employeeId: c.employee.id, eventType: "TREATMENT_INCENTIVE", sourceType: "SESSION_CONTRIBUTION", sourceId: sessionId, sourceLineId: c.id,
      policyVersionId: policy.versionId, ruleId: rule.id, eventDate: c.startedAt ?? c.createdAt,
      basisAmount: rule.basisType === "PER_MINUTE" ? new Prisma.Decimal(minutes) : new Prisma.Decimal(base),
      quantity: rule.basisType === "PER_MINUTE" ? new Prisma.Decimal(minutes) : new Prisma.Decimal(1),
      rate: rule.ratePercent ?? null, weight: applyWeight ? new Prisma.Decimal(wt) : null,
      amount: new Prisma.Decimal(amount), calculationSnapshot: {
        why: `Thưởng thực hiện dịch vụ`, policy: policy.policyCode, policyVersion: policy.version, rule: rule.code,
        service: c.serviceNameSnapshot, contributionType: c.contributionTypeCode, role: c.employeeRoleSnapshot,
        basisType: rule.basisType, base, minutes, weightMode: rule.weightMode, weightApplied: applyWeight ? wt : null, amount,
      } as any,
      employeeSnapshot: c.employee.fullName, branchSnapshot: c.branchId ?? c.employee.branchId ?? null, status: "ELIGIBLE",
      idempotencyKey: `TI:${c.id}:${rule.id}`, createdBy: actor(session),
    });
    created++;
    await auditLog({ userId: session.userId, action: "COMPENSATION_EVENT_CREATED", entityType: "CompensationEvent", entityId: ev.id, changes: { type: "TREATMENT_INCENTIVE", amount } });
  }
  return { created, reversed };
}

// =============================================================================
// SALES COMMISSION — nguồn = TIỀN THỰC THU (Payment chưa hủy / Deposit ALLOCATED).
// =============================================================================
function commissionSpecificity(r: any): number { return r.attributionRole ? 1 : 0; }

async function matchCommissionRule(versionId: string, attributionRole: string, basis: number) {
  const rules = await prisma.commissionRule.findMany({ where: { policyVersionId: versionId, isActive: true, basisType: "COLLECTED_CASH", targetType: "ALL" } });
  const matches = rules.filter((r) =>
    (r.attributionRole == null || r.attributionRole === attributionRole) &&
    (r.thresholdMin == null || basis >= num(r.thresholdMin))
  );
  if (!matches.length) return null;
  const scored = matches.map((r) => ({ r, score: commissionSpecificity(r) * 1000 + r.priority }));
  scored.sort((a, b) => b.score - a.score);
  if (scored.length > 1 && scored[0].score === scored[1].score) throw new CompError(`Xung đột rule hoa hồng cùng độ ưu tiên (${scored[0].r.code}, ${scored[1].r.code}).`, 409);
  return scored[0].r;
}

/** Sinh hoa hồng cho 1 phiếu thu / cọc đã phân bổ (idempotent; void → reverse). */
export async function generateSalesCommissionForPayment(session: SessionPayload, paymentId: string): Promise<{ created: number; reversed: number }> {
  const p = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!p) throw new CompError("Không tìm thấy phiếu thu", 404);

  // §Q/§11 — phiếu thu đã HỦY → reverse mọi event của nó.
  if (p.voidedAt) return reverseCommissionForSource(session, "PAYMENT", paymentId, "Phiếu thu đã hủy");
  return generateCommissionForCashSource(session, { sourceType: "PAYMENT", sourceId: p.id, amount: num(p.amount), eventDate: p.paidAt, invoiceId: p.invoiceId, customerId: p.customerId });
}

/** Sinh hoa hồng cho 1 cọc ĐÃ PHÂN BỔ. */
export async function generateSalesCommissionForDeposit(session: SessionPayload, depositId: string): Promise<{ created: number; reversed: number }> {
  const d = await prisma.deposit.findUnique({ where: { id: depositId } });
  if (!d) throw new CompError("Không tìm thấy phiếu cọc", 404);
  if (d.status !== "ALLOCATED") return reverseCommissionForSource(session, "DEPOSIT", depositId, "Cọc chưa phân bổ / đã hoàn");
  return generateCommissionForCashSource(session, { sourceType: "DEPOSIT", sourceId: d.id, amount: num(d.amount), eventDate: d.allocatedAt ?? d.receivedAt, invoiceId: d.invoiceId, customerId: d.customerId });
}

async function generateCommissionForCashSource(
  session: SessionPayload,
  src: { sourceType: "PAYMENT" | "DEPOSIT"; sourceId: string; amount: number; eventDate: Date; invoiceId: string | null; customerId: string },
): Promise<{ created: number; reversed: number }> {
  if (src.amount <= 0) return { created: 0, reversed: 0 };
  // Attribution: ưu tiên INVOICE của nguồn tiền, else CUSTOMER.
  let attributions = src.invoiceId
    ? await prisma.salesAttribution.findMany({ where: { sourceType: "INVOICE", sourceId: src.invoiceId, status: "ACTIVE" }, include: { employee: { select: { id: true, branchId: true, roles: true, fullName: true } } } })
    : [];
  if (!attributions.length) {
    attributions = await prisma.salesAttribution.findMany({ where: { sourceType: "CUSTOMER", sourceId: src.customerId, status: "ACTIVE" }, include: { employee: { select: { id: true, branchId: true, roles: true, fullName: true } } } });
  }
  let created = 0;
  for (const a of attributions) {
    const policy = await resolvePolicyForEmployee({ id: a.employee.id, branchId: a.employee.branchId, roles: a.employee.roles }, src.eventDate);
    if (!policy) continue;
    const rule = await matchCommissionRule(policy.versionId, a.attributionRole, src.amount);
    if (!rule) continue;
    const basis = rule.thresholdMax != null ? Math.min(src.amount, num(rule.thresholdMax)) : src.amount;
    const wt = num(a.weight) || 1;
    let amount = (num(rule.ratePercent) / 100) * basis * wt + num(rule.fixedAmount) * wt;
    amount = Math.round(amount);
    if (amount <= 0) continue;
    const ev = await createEventIdem({
      employeeId: a.employee.id, eventType: "SALES_COMMISSION", sourceType: src.sourceType as any, sourceId: src.sourceId, sourceLineId: a.id,
      policyVersionId: policy.versionId, ruleId: rule.id, eventDate: src.eventDate,
      basisAmount: new Prisma.Decimal(basis), quantity: new Prisma.Decimal(1), rate: rule.ratePercent ?? null, weight: new Prisma.Decimal(wt),
      amount: new Prisma.Decimal(amount), calculationSnapshot: {
        why: "Hoa hồng bán hàng (tiền thực thu)", policy: policy.policyCode, policyVersion: policy.version, rule: rule.code,
        basisType: rule.basisType, collectedCash: src.amount, basisCapped: basis, ratePercent: num(rule.ratePercent), attributionRole: a.attributionRole, weight: wt, amount,
      } as any,
      employeeSnapshot: a.employee.fullName, branchSnapshot: a.branchId ?? a.employee.branchId ?? null, status: "ELIGIBLE",
      idempotencyKey: `SC:${src.sourceType}:${src.sourceId}:${a.employee.id}:${rule.id}`, createdBy: actor(session),
    });
    created++;
    await auditLog({ userId: session.userId, action: "COMPENSATION_EVENT_CREATED", entityType: "CompensationEvent", entityId: ev.id, changes: { type: "SALES_COMMISSION", amount } });
  }
  return { created, reversed: 0 };
}

async function reverseCommissionForSource(session: SessionPayload, sourceType: string, sourceId: string, reason: string): Promise<{ created: number; reversed: number }> {
  const events = await prisma.compensationEvent.findMany({ where: { eventType: "SALES_COMMISSION", sourceType: sourceType as any, sourceId, status: "ELIGIBLE" } });
  let reversed = 0;
  for (const ev of events) { await reverseCompensationEvent(session, ev.id, reason); reversed++; }
  return { created: 0, reversed };
}

// =============================================================================
// KPI BONUS — nguồn = EmployeeKpiSnapshot đã KHÓA + VERIFIED (mặc định).
// =============================================================================
function cmp(comparator: string, value: number, threshold: number): boolean {
  switch (comparator) { case "GTE": return value >= threshold; case "GT": return value > threshold; case "LTE": return value <= threshold; case "LT": return value < threshold; case "EQ": return value === threshold; default: return false; }
}

/** Sinh KPI bonus candidate cho 1 kỳ đã KHÓA (idempotent). */
export async function generateKpiBonusesForPeriod(session: SessionPayload, periodId: string): Promise<{ created: number }> {
  const period = await prisma.kpiPeriod.findUnique({ where: { id: periodId } });
  if (!period) throw new CompError("Không tìm thấy kỳ KPI", 404);
  if (period.status !== "LOCKED") throw new CompError("KPI bonus chỉ sinh từ kỳ đã KHÓA (bất biến).", 409);

  const snapshots = await prisma.employeeKpiSnapshot.findMany({
    where: { kpiPeriodId: periodId, status: "CURRENT", lockedAt: { not: null } },
    include: { employee: { select: { id: true, branchId: true, roles: true, fullName: true } }, definition: { select: { id: true, code: true, name: true } } },
  });
  let created = 0;
  for (const s of snapshots) {
    const policy = await resolvePolicyForEmployee({ id: s.employee.id, branchId: s.employee.branchId, roles: s.employee.roles }, period.lockedAt ?? now());
    if (!policy) continue;
    const rules = await prisma.kpiBonusRule.findMany({ where: { policyVersionId: policy.versionId, isActive: true, kpiDefinitionId: s.kpiDefinitionId } });
    // eligible rules; chọn bậc tốt nhất theo (tier, threshold).
    const value = num(s.value);
    const eligible = rules.filter((r) => {
      if (r.requireVerified && s.sourceQuality !== "VERIFIED") return false; // §21 — LEGACY/INSUFFICIENT không được thưởng (mặc định)
      return cmp(r.comparator, value, num(r.threshold));
    });
    if (!eligible.length) continue;
    eligible.sort((a, b) => (b.tier - a.tier) || (num(b.threshold) - num(a.threshold)));
    const rule = eligible[0];
    let amount = rule.bonusType === "FIXED" ? num(rule.fixedAmount) : num(rule.rate) * value;
    amount = Math.round(amount);
    if (amount <= 0) continue;
    const ev = await createEventIdem({
      employeeId: s.employee.id, eventType: "KPI_BONUS", sourceType: "KPI_SNAPSHOT", sourceId: periodId, sourceLineId: s.id,
      policyVersionId: policy.versionId, ruleId: rule.id, eventDate: period.lockedAt ?? now(),
      basisAmount: new Prisma.Decimal(value), quantity: new Prisma.Decimal(1), rate: rule.rate ?? null, weight: null,
      amount: new Prisma.Decimal(amount), calculationSnapshot: {
        why: "Thưởng KPI (kỳ đã khóa, nguồn VERIFIED)", policy: policy.policyCode, policyVersion: policy.version, rule: rule.code,
        kpi: s.definition.code, value, comparator: rule.comparator, threshold: num(rule.threshold), sourceQuality: s.sourceQuality, bonusType: rule.bonusType, amount,
        kpiSnapshotId: s.id, kpiPeriod: period.code,
      } as any,
      employeeSnapshot: s.employee.fullName, branchSnapshot: s.branchSnapshot ?? s.employee.branchId ?? null, status: "ELIGIBLE",
      idempotencyKey: `KB:${s.id}:${rule.id}`, createdBy: actor(session),
    });
    created++;
    await auditLog({ userId: session.userId, action: "COMPENSATION_EVENT_CREATED", entityType: "CompensationEvent", entityId: ev.id, changes: { type: "KPI_BONUS", amount } });
  }
  return { created };
}

// =============================================================================
// REVERSAL — bút toán bù (append-only, không hard-delete, chặn hoàn tác 2 lần).
// =============================================================================
export async function reverseCompensationEvent(session: SessionPayload, eventId: string, reason: string): Promise<void> {
  if (!reason) throw new CompError("Cần lý do hoàn tác", 422);
  await prisma.$transaction(async (tx) => {
    const ev = await tx.compensationEvent.findUnique({ where: { id: eventId } });
    if (!ev) throw new CompError("Không tìm thấy event", 404);
    if (ev.eventType === "REVERSAL") throw new CompError("Không thể hoàn tác một bút toán hoàn tác", 422);
    if (ev.status === "REVERSED" || ev.reversedAt) throw new CompError("Event đã được hoàn tác trước đó", 409);
    await tx.compensationEvent.create({
      data: {
        employeeId: ev.employeeId, eventType: "REVERSAL", sourceType: ev.sourceType, sourceId: ev.sourceId, sourceLineId: ev.sourceLineId,
        policyVersionId: ev.policyVersionId, ruleId: ev.ruleId, eventDate: now(),
        basisAmount: ev.basisAmount, quantity: ev.quantity, rate: ev.rate, weight: ev.weight,
        amount: new Prisma.Decimal(-num(ev.amount)), calculationSnapshot: { why: "Bút toán hoàn tác (net về 0)", reversalOf: ev.id, reason, originalAmount: num(ev.amount) } as any,
        employeeSnapshot: ev.employeeSnapshot, branchSnapshot: ev.branchSnapshot, status: "ELIGIBLE",
        reversalOfId: ev.id, idempotencyKey: `REV:${ev.id}`, createdBy: actor(session),
      },
    });
    await tx.compensationEvent.update({ where: { id: ev.id }, data: { status: "REVERSED", reversedAt: now(), reversedBy: actor(session), reversalReason: reason } });
  });
  await auditLog({ userId: session.userId, action: "COMPENSATION_EVENT_REVERSED", entityType: "CompensationEvent", entityId: eventId, changes: { reason } });
}
