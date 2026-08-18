// =============================================================================
// HR-PH3 — Service sổ đóng góp nhân sự theo buổi (actual work evidence).
//  * Bất biến sau freeze buổi; sửa qua REVERSAL (mẫu MaterialUsage). KHÔNG hard-delete.
//  * KHÔNG tiền lương/hoa hồng. weight = trọng số vận hành (HR-PH5 mới diễn giải ra tiền).
//  * Cross-check chấm công (HR-PH2) → CẢNH BÁO, không chặn lâm sàng (trừ dữ liệu bất khả).
// =============================================================================
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { parseVnLocal } from "./timezone";
import { auditLog } from "./clinic";
import type { SessionPayload } from "./auth";

export class ContributionError extends Error {
  status: number;
  constructor(message: string, status = 409) { super(message); this.status = status; }
}
type Session = SessionPayload;
const now = () => new Date();
function toInstant(v: string | null | undefined): Date | null { return v == null || v === "" ? null : parseVnLocal(v); }

/** Danh mục loại đóng góp mặc định (seed idempotent — config additive). */
export const CONTRIBUTION_TYPE_SEED: { code: string; name: string; category: string; sortOrder: number; defaultWeight?: number }[] = [
  { code: "ASSESSMENT", name: "Đánh giá", category: "assess", sortOrder: 1 },
  { code: "CONSULTATION", name: "Tư vấn", category: "assess", sortOrder: 2 },
  { code: "PRIMARY_OPERATOR", name: "Thực hiện chính", category: "perform", sortOrder: 3, defaultWeight: 1 },
  { code: "ASSISTANT", name: "Hỗ trợ", category: "perform", sortOrder: 4, defaultWeight: 0.3 },
  { code: "MASTER_SUPERVISION", name: "Master giám sát", category: "supervise", sortOrder: 5, defaultWeight: 0.25 },
  { code: "TECHNOLOGY_OPERATOR", name: "Vận hành công nghệ", category: "perform", sortOrder: 6 },
  { code: "RECOVERY", name: "Phục hồi", category: "perform", sortOrder: 7 },
  { code: "OTHER", name: "Khác", category: "other", sortOrder: 99 },
];
export async function ensureContributionTypes(tx: Prisma.TransactionClient = prisma) {
  for (const t of CONTRIBUTION_TYPE_SEED) {
    await tx.staffContributionType.upsert({ where: { code: t.code }, update: {}, create: { code: t.code, name: t.name, category: t.category, sortOrder: t.sortOrder, defaultWeight: t.defaultWeight ?? null } });
  }
}

export interface CrossCheckFlag { code: string; severity: "INFO" | "WARNING"; message: string }

/** Đối chiếu chấm công HR-PH2 → cờ cảnh báo (KHÔNG chặn). */
export async function crossCheckContribution(
  employeeId: string, at: Date | null, endAt: Date | null, branchId: string | null,
  excludeId: string | null = null, tx: Prisma.TransactionClient = prisma,
): Promise<CrossCheckFlag[]> {
  const flags: CrossCheckFlag[] = [];
  const t = at ?? now();
  // Nghỉ phép đã duyệt bao trùm
  const onLeave = await tx.employeeLeave.count({ where: { employeeId, status: "APPROVED", fromAt: { lte: t }, toAt: { gte: t } } });
  if (onLeave > 0) flags.push({ code: "ON_APPROVED_LEAVE", severity: "WARNING", message: "Nhân sự đang trong kỳ nghỉ đã duyệt" });
  // Chấm công bao trùm thời điểm
  const att = await tx.attendanceRecord.findFirst({
    where: { employeeId, status: { not: "VOIDED" }, checkInAt: { lte: t }, OR: [{ checkOutAt: null }, { checkOutAt: { gte: t } }] },
    select: { branchId: true, checkInAt: true },
  });
  if (!att) flags.push({ code: "NO_ATTENDANCE", severity: "WARNING", message: "Không có bản chấm công bao trùm thời điểm đóng góp" });
  else if (branchId && att.branchId && att.branchId !== branchId) flags.push({ code: "BRANCH_MISMATCH", severity: "WARNING", message: "Chi nhánh đóng góp khác chi nhánh chấm công" });
  // Không có ca dated (chỉ INFO nếu đã có attendance)
  if (at) {
    const shift = await tx.workShift.count({ where: { employeeId, status: { not: "CANCELLED" }, scheduledStartAt: { lte: t }, scheduledEndAt: { gte: t } } });
    if (shift === 0 && att) flags.push({ code: "NO_SHIFT", severity: "INFO", message: "Không có ca theo lịch nhưng có chấm công hợp lệ" });
    else if (shift === 0 && !att) { /* đã có NO_ATTENDANCE */ }
  }
  // Đóng góp chồng thời gian của cùng nhân sự (giao khoảng) — có thể ở chi nhánh khác
  if (at && endAt) {
    const overlaps = await tx.sessionStaffContribution.findMany({
      where: {
        employeeId, status: { not: "REVERSED" }, entryKind: "CONTRIBUTION", ...(excludeId ? { id: { not: excludeId } } : {}),
        startedAt: { lt: endAt }, endedAt: { gt: at },
      },
      select: { branchId: true },
    });
    if (overlaps.length > 0) {
      flags.push({ code: "OVERLAP_CONTRIBUTION", severity: "WARNING", message: "Trùng thời gian với đóng góp khác của cùng nhân sự" });
      if (overlaps.some((o) => o.branchId && branchId && o.branchId !== branchId))
        flags.push({ code: "TWO_BRANCHES_SAME_TIME", severity: "WARNING", message: "Nhân sự ở hai chi nhánh cùng thời điểm" });
    }
  }
  return flags;
}

function deriveMinutes(startedAt: Date | null, endedAt: Date | null, manualMinutes: number | null | undefined): number | null {
  if (startedAt && endedAt) {
    const m = Math.round((endedAt.getTime() - startedAt.getTime()) / 60000);
    if (m < 0) throw new ContributionError("Giờ kết thúc không thể trước giờ bắt đầu", 422);
    return m;
  }
  if (manualMinutes != null) { if (manualMinutes < 0) throw new ContributionError("Số phút không hợp lệ", 422); return manualMinutes; }
  return null;
}

export interface CreateContribInput {
  treatmentSessionId: string; sessionExecutionItemId?: string | null; serviceStepKey?: string | null;
  employeeId: string; contributionTypeCode: string; startedAt?: string | null; endedAt?: string | null;
  actualMinutes?: number | null; weight?: number | null; quantity?: number | null; branchId?: string | null;
  source?: string | null; note?: string | null; idempotencyKey?: string | null;
}
/** canWrite=treatment.write; canEditCompleted=treatment.editCompleted (bắt buộc nếu buổi đã freeze). */
export async function createContribution(session: Session, input: CreateContribInput, canWrite: boolean, canEditCompleted: boolean) {
  if (!canWrite) throw new ContributionError("Không có quyền ghi đóng góp", 403);
  // Idempotency: trùng key → trả bản cũ (không tạo trùng).
  if (input.idempotencyKey) {
    const dup = await prisma.sessionStaffContribution.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (dup) return dup;
  }
  const sess = await prisma.treatmentSession.findUnique({ where: { id: input.treatmentSessionId }, select: { id: true, executionFrozenAt: true } });
  if (!sess) throw new ContributionError("Không tìm thấy buổi", 404);
  const frozen = !!sess.executionFrozenAt;
  if (frozen && !canEditCompleted) throw new ContributionError("Buổi đã đông cứng — cần quyền sửa buổi đã hoàn thành", 403);

  // Item phải thuộc đúng buổi
  let serviceIdSnapshot: string | null = null, serviceNameSnapshot: string | null = null;
  if (input.sessionExecutionItemId) {
    const item = await prisma.sessionExecutionItem.findUnique({ where: { id: input.sessionExecutionItemId }, include: { service: { select: { name: true } } } });
    if (!item || item.sessionId !== input.treatmentSessionId) throw new ContributionError("Dịch vụ thực hiện không thuộc buổi này", 422);
    serviceIdSnapshot = item.serviceId; serviceNameSnapshot = item.service?.name ?? null;
  }
  const emp = await prisma.employee.findUnique({ where: { id: input.employeeId }, select: { id: true, fullName: true, title: true, roles: true, branchId: true } });
  if (!emp) throw new ContributionError("Không tìm thấy nhân sự", 422);

  const ctype = await prisma.staffContributionType.findUnique({ where: { code: input.contributionTypeCode } });
  const startedAt = toInstant(input.startedAt), endedAt = toInstant(input.endedAt);
  const actualMinutes = deriveMinutes(startedAt, endedAt, input.actualMinutes);
  const branchId = input.branchId ?? emp.branchId ?? null;
  const flags = await crossCheckContribution(input.employeeId, startedAt, endedAt, branchId);

  try {
    const rec = await prisma.sessionStaffContribution.create({
      data: {
        treatmentSessionId: input.treatmentSessionId, sessionExecutionItemId: input.sessionExecutionItemId ?? null,
        serviceStepKey: input.serviceStepKey ?? null, serviceIdSnapshot, serviceNameSnapshot,
        employeeId: input.employeeId, employeeNameSnapshot: emp.fullName,
        employeeRoleSnapshot: emp.title ?? (emp.roles?.[0] ?? null),
        contributionTypeId: ctype?.id ?? null, contributionTypeCode: input.contributionTypeCode,
        startedAt, endedAt, actualMinutes, weight: input.weight ?? null, quantity: input.quantity ?? null,
        branchId, source: (input.source as any) ?? "MANUAL", entryKind: "CONTRIBUTION",
        status: frozen ? "ACTIVE" : "DRAFT", crossCheckFlags: flags as any, note: input.note ?? null,
        idempotencyKey: input.idempotencyKey ?? null, createdBy: session.name ?? session.email ?? null,
      },
    });
    await auditLog({ userId: session.userId, action: "SESSION_STAFF_CONTRIBUTION_CREATED", entityType: "SessionStaffContribution", entityId: rec.id, changes: { session: input.treatmentSessionId, employeeId: input.employeeId, type: input.contributionTypeCode, minutes: actualMinutes, flags: flags.map((f) => f.code) } });
    return rec;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && input.idempotencyKey) {
      const dup = await prisma.sessionStaffContribution.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (dup) return dup;
    }
    throw e;
  }
}

/** Sửa DRAFT (trước freeze). ACTIVE/REVERSED → chặn (dùng reverse). */
export async function updateDraftContribution(session: Session, id: string, patch: Partial<CreateContribInput>, canWrite: boolean) {
  if (!canWrite) throw new ContributionError("Không có quyền", 403);
  const rec = await prisma.sessionStaffContribution.findUnique({ where: { id }, include: { session: { select: { executionFrozenAt: true } } } });
  if (!rec) throw new ContributionError("Không tìm thấy đóng góp", 404);
  if (rec.status !== "DRAFT" || rec.session.executionFrozenAt) throw new ContributionError("Chỉ sửa được đóng góp DRAFT (buổi chưa đông cứng) — dùng hoàn tác/điều chỉnh", 409);
  const startedAt = patch.startedAt !== undefined ? toInstant(patch.startedAt) : rec.startedAt;
  const endedAt = patch.endedAt !== undefined ? toInstant(patch.endedAt) : rec.endedAt;
  const actualMinutes = deriveMinutes(startedAt, endedAt, patch.actualMinutes ?? (rec.actualMinutes ?? null));
  const updated = await prisma.sessionStaffContribution.update({
    where: { id }, data: {
      ...(patch.contributionTypeCode ? { contributionTypeCode: patch.contributionTypeCode } : {}),
      startedAt, endedAt, actualMinutes,
      ...(patch.weight !== undefined ? { weight: patch.weight } : {}),
      ...(patch.quantity !== undefined ? { quantity: patch.quantity } : {}),
      ...(patch.branchId !== undefined ? { branchId: patch.branchId } : {}),
      ...(patch.note !== undefined ? { note: patch.note } : {}),
    },
  });
  await auditLog({ userId: session.userId, action: "SESSION_STAFF_CONTRIBUTION_UPDATED_DRAFT", entityType: "SessionStaffContribution", entityId: id, changes: { fields: Object.keys(patch) } });
  return updated;
}

/** Hoàn tác (compensating) — giữ bản gốc, tạo bút toán REVERSAL net về 0. Chặn hoàn tác 2 lần. */
export async function reverseContribution(session: Session, id: string, reason: string, canWrite: boolean, canEditCompleted: boolean) {
  if (!canWrite) throw new ContributionError("Không có quyền", 403);
  return prisma.$transaction(async (tx) => {
    const rec = await tx.sessionStaffContribution.findUnique({ where: { id }, include: { session: { select: { executionFrozenAt: true } } } });
    if (!rec) throw new ContributionError("Không tìm thấy đóng góp", 404);
    if (rec.entryKind === "REVERSAL") throw new ContributionError("Không thể hoàn tác một bút toán hoàn tác", 422);
    if (rec.reversedAt) throw new ContributionError("Đóng góp đã được hoàn tác trước đó", 409);
    if (rec.session.executionFrozenAt && !canEditCompleted) throw new ContributionError("Buổi đã đông cứng — cần quyền sửa buổi đã hoàn thành", 403);
    const reversal = await tx.sessionStaffContribution.create({
      data: {
        treatmentSessionId: rec.treatmentSessionId, sessionExecutionItemId: rec.sessionExecutionItemId,
        serviceStepKey: rec.serviceStepKey, serviceIdSnapshot: rec.serviceIdSnapshot, serviceNameSnapshot: rec.serviceNameSnapshot,
        employeeId: rec.employeeId, employeeNameSnapshot: rec.employeeNameSnapshot, employeeRoleSnapshot: rec.employeeRoleSnapshot,
        contributionTypeId: rec.contributionTypeId, contributionTypeCode: rec.contributionTypeCode,
        startedAt: rec.startedAt, endedAt: rec.endedAt,
        actualMinutes: rec.actualMinutes == null ? null : -rec.actualMinutes, // net về 0
        weight: rec.weight == null ? null : new Prisma.Decimal(rec.weight).negated(),
        quantity: rec.quantity == null ? null : new Prisma.Decimal(rec.quantity).negated(),
        branchId: rec.branchId, source: "MANUAL", entryKind: "REVERSAL", status: "ACTIVE",
        reversalOfId: rec.id, note: reason, createdBy: session.name ?? session.email ?? null,
      },
    });
    await tx.sessionStaffContribution.update({ where: { id: rec.id }, data: { status: "REVERSED", reversedAt: now(), reversedBy: session.name ?? session.email ?? null, reversalReason: reason } });
    await auditLog({ userId: session.userId, action: "SESSION_STAFF_CONTRIBUTION_REVERSED", entityType: "SessionStaffContribution", entityId: rec.id, changes: { reversalId: reversal.id, reason } });
    return reversal;
  });
}

/** Khi buổi đông cứng: DRAFT → ACTIVE (bất biến). Gọi trong luồng freeze session. */
export async function freezeSessionContributions(sessionId: string, tx: Prisma.TransactionClient = prisma) {
  await tx.sessionStaffContribution.updateMany({ where: { treatmentSessionId: sessionId, status: "DRAFT" }, data: { status: "ACTIVE" } });
}
