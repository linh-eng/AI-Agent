// =============================================================================
// HR-PH4 — KPI ENGINE + PERIOD SNAPSHOT
// -----------------------------------------------------------------------------
// KPI = ĐO LƯỜNG HIỆU SUẤT. KHÔNG tự động ảnh hưởng lương/thưởng (không hidden
// coupling). Chỉ dùng FACT đáng tin:
//   * SessionStaffContribution (VERIFIED) — hiệu lực = entryKind CONTRIBUTION +
//     status ACTIVE (loại bản đã REVERSED và dòng REVERSAL → NET đúng, không đếm
//     đôi).
//   * AttendanceRecord (VERIFIED) — status COMPLETED/ADJUSTED (đã checkout).
//   * TreatmentSession (incident, completed) qua liên kết contribution.
//   * SessionReview — VERIFIED nếu khớp FK employeeId; LEGACY_NAME_MATCH nếu chỉ
//     khớp tên (technicianName) và tên là DUY NHẤT; else INSUFFICIENT (KHÔNG quy
//     nhầm cho nhân sự khác).
//   * EmployeeLeave (APPROVED) — phân biệt nghỉ có duyệt với vắng mặt.
// Chi nhánh/vai trò suy từ FACT tại thời điểm (event-time) — KHÔNG dùng hồ sơ
// hiện tại. Snapshot theo kỳ BẤT BIẾN khi LOCKED; tính lại (kỳ chưa khóa) =
// supersede bản CURRENT cũ (append-only, version++). SALES KPI: DEFER (attribution
// chưa đáng tin — HR-PH0).
// =============================================================================
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { sequentialCode, auditLog } from "./clinic";
import { parseVnLocal } from "./timezone";
import type { SessionPayload } from "./auth";

const now = () => new Date();

export class KpiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

// -----------------------------------------------------------------------------
// Danh mục KPI khởi tạo (MASTER DATA cấu hình). Công thức theo `code` nằm trong
// engine (deterministic). calculationType/sourceType là metadata mô tả.
// Chỉ seed KPI được hỗ trợ bởi dữ liệu đáng tin.
// -----------------------------------------------------------------------------
export const KPI_DEFINITION_SEED: Array<{
  code: string; name: string; category: string; unit: string;
  calculationType: string; sourceType: string; direction: string; sortOrder: number;
}> = [
  // PRODUCTIVITY (VERIFIED — contribution ledger)
  { code: "sessions_contributed", name: "Số buổi tham gia", category: "PRODUCTIVITY", unit: "buổi", calculationType: "COUNT_DISTINCT", sourceType: "CONTRIBUTION", direction: "HIGHER_BETTER", sortOrder: 10 },
  { code: "services_performed", name: "Số lượt dịch vụ thực hiện", category: "PRODUCTIVITY", unit: "lượt", calculationType: "COUNT_DISTINCT", sourceType: "CONTRIBUTION", direction: "HIGHER_BETTER", sortOrder: 20 },
  { code: "treatment_minutes", name: "Tổng phút điều trị", category: "PRODUCTIVITY", unit: "phút", calculationType: "SUM", sourceType: "CONTRIBUTION", direction: "HIGHER_BETTER", sortOrder: 30 },
  // ATTENDANCE (VERIFIED)
  { code: "worked_minutes", name: "Phút làm việc (chấm công)", category: "ATTENDANCE", unit: "phút", calculationType: "SUM", sourceType: "ATTENDANCE", direction: "HIGHER_BETTER", sortOrder: 40 },
  { code: "attendance_days", name: "Số ngày công", category: "ATTENDANCE", unit: "ngày", calculationType: "COUNT_DISTINCT", sourceType: "ATTENDANCE", direction: "HIGHER_BETTER", sortOrder: 50 },
  { code: "late_minutes", name: "Phút đi trễ", category: "ATTENDANCE", unit: "phút", calculationType: "SUM", sourceType: "ATTENDANCE", direction: "LOWER_BETTER", sortOrder: 60 },
  { code: "early_leave_minutes", name: "Phút về sớm", category: "ATTENDANCE", unit: "phút", calculationType: "SUM", sourceType: "ATTENDANCE", direction: "LOWER_BETTER", sortOrder: 70 },
  { code: "overtime_candidate_minutes", name: "Phút OT (ứng viên, chưa duyệt)", category: "ATTENDANCE", unit: "phút", calculationType: "SUM", sourceType: "ATTENDANCE", direction: "NEUTRAL", sortOrder: 80 },
  { code: "approved_leave_days", name: "Số ngày nghỉ có duyệt", category: "ATTENDANCE", unit: "ngày", calculationType: "COUNT_DISTINCT", sourceType: "LEAVE", direction: "NEUTRAL", sortOrder: 90 },
  // QUALITY
  { code: "incident_count", name: "Số sự cố", category: "QUALITY", unit: "vụ", calculationType: "COUNT", sourceType: "SESSION", direction: "LOWER_BETTER", sortOrder: 100 },
  // CUSTOMER / REVIEW (chất lượng nguồn phụ thuộc FK/tên — đánh dấu rõ)
  { code: "avg_technician_score", name: "Điểm KTV trung bình", category: "CUSTOMER", unit: "điểm", calculationType: "AVERAGE", sourceType: "REVIEW", direction: "HIGHER_BETTER", sortOrder: 110 },
  { code: "avg_satisfaction", name: "Hài lòng trung bình", category: "CUSTOMER", unit: "điểm", calculationType: "AVERAGE", sourceType: "REVIEW", direction: "HIGHER_BETTER", sortOrder: 120 },
  { code: "review_count", name: "Số lượt đánh giá", category: "CUSTOMER", unit: "lượt", calculationType: "COUNT", sourceType: "REVIEW", direction: "NEUTRAL", sortOrder: 130 },
];

/** Danh sách code KPI mà engine có công thức (deterministic). */
export const SUPPORTED_KPI_CODES = new Set(KPI_DEFINITION_SEED.map((d) => d.code));

/** Upsert danh mục KPI (lazy-seed). Không xóa/không đổi định nghĩa người dùng. */
export async function ensureKpiDefinitions(tx: Prisma.TransactionClient = prisma) {
  for (const d of KPI_DEFINITION_SEED) {
    await tx.kpiDefinition.upsert({
      where: { code: d.code },
      update: {}, // giữ nguyên nếu đã có (cho phép admin đổi tên/tắt)
      create: {
        code: d.code, name: d.name, category: d.category as any, unit: d.unit,
        calculationType: d.calculationType as any, sourceType: d.sourceType as any,
        direction: d.direction as any, sortOrder: d.sortOrder,
      },
    });
  }
}

// -----------------------------------------------------------------------------
// Hiệu lực (NET) của contribution — dùng CHUNG cho KPI (chống đếm đôi reversal).
// -----------------------------------------------------------------------------
export function effectiveContributionWhere(): Prisma.SessionStaffContributionWhereInput {
  return { entryKind: "CONTRIBUTION", status: "ACTIVE" };
}

// -----------------------------------------------------------------------------
// Ranh giới thời gian của kỳ theo lịch VN.
// -----------------------------------------------------------------------------
function dateOnly(d: Date): string {
  // Prisma @db.Date trả về Date tại UTC 00:00 → lấy theo UTC parts.
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

export function periodBounds(period: { startDate: Date; endDate: Date }) {
  const startStr = dateOnly(period.startDate);
  const endStr = dateOnly(period.endDate);
  const startInstant = parseVnLocal(`${startStr}T00:00:00`);
  const endInstant = new Date(parseVnLocal(`${endStr}T23:59:59`).getTime() + 999);
  return { startStr, endStr, startInstant, endInstant };
}

// -----------------------------------------------------------------------------
// FACT bundle của 1 nhân sự trong kỳ (event-time + branch filter).
// -----------------------------------------------------------------------------
type EmployeeFacts = {
  contributions: Array<{
    id: string; treatmentSessionId: string; sessionExecutionItemId: string | null;
    actualMinutes: number | null; branchId: string | null; startedAt: Date | null; createdAt: Date;
    employeeRoleSnapshot: string | null; contributionTypeCode: string;
    session: { id: string; incident: string | null; status: string; performedAt: Date | null };
  }>;
  attendance: Array<{
    id: string; workDate: Date; workedMinutes: number | null; lateMinutes: number | null;
    earlyLeaveMinutes: number | null; overtimeMinutes: number | null; branchId: string | null; status: string;
  }>;
  leaves: Array<{ id: string; fromAt: Date; toAt: Date; isPaid: boolean }>;
  reviews: Array<{ id: string; technicianScore: number | null; satisfactionScore: number | null; matchedBy: "FK" | "NAME" }>;
};

async function loadEmployeeFacts(
  emp: { id: string; fullName: string },
  bounds: ReturnType<typeof periodBounds>,
  branchId: string | null,
  nameUnique: boolean,
): Promise<EmployeeFacts> {
  const branchFilter = branchId ? { branchId } : {};

  const rawContribs = await prisma.sessionStaffContribution.findMany({
    where: {
      employeeId: emp.id,
      ...effectiveContributionWhere(),
      ...branchFilter,
    },
    select: {
      id: true, treatmentSessionId: true, sessionExecutionItemId: true, actualMinutes: true,
      branchId: true, startedAt: true, createdAt: true, employeeRoleSnapshot: true, contributionTypeCode: true,
      session: { select: { id: true, incident: true, status: true, performedAt: true } },
    },
  });
  // Anchor event-time = startedAt ?? createdAt; lọc trong kỳ.
  const contributions = rawContribs.filter((c) => {
    const anchor = c.startedAt ?? c.createdAt;
    return anchor >= bounds.startInstant && anchor <= bounds.endInstant;
  });

  const attendance = await prisma.attendanceRecord.findMany({
    where: {
      employeeId: emp.id,
      status: { in: ["COMPLETED", "ADJUSTED"] },
      workDate: { gte: new Date(`${bounds.startStr}T00:00:00.000Z`), lte: new Date(`${bounds.endStr}T00:00:00.000Z`) },
      ...branchFilter,
    },
    select: {
      id: true, workDate: true, workedMinutes: true, lateMinutes: true, earlyLeaveMinutes: true,
      overtimeMinutes: true, branchId: true, status: true,
    },
  });

  const leaves = await prisma.employeeLeave.findMany({
    where: {
      employeeId: emp.id, status: "APPROVED",
      fromAt: { lte: bounds.endInstant }, toAt: { gte: bounds.startInstant },
    },
    select: { id: true, fromAt: true, toAt: true, isPaid: true },
  });

  // Reviews: FK-first (VERIFIED); name-match chỉ khi tên DUY NHẤT (chống quy nhầm).
  const fkReviews = await prisma.sessionReview.findMany({
    where: { employeeId: emp.id, createdAt: { gte: bounds.startInstant, lte: bounds.endInstant } },
    select: { id: true, technicianScore: true, satisfactionScore: true },
  });
  let nameReviews: typeof fkReviews = [];
  if (nameUnique && emp.fullName) {
    nameReviews = await prisma.sessionReview.findMany({
      where: {
        technicianName: emp.fullName, employeeId: null,
        createdAt: { gte: bounds.startInstant, lte: bounds.endInstant },
      },
      select: { id: true, technicianScore: true, satisfactionScore: true },
    });
  }
  const reviews = [
    ...fkReviews.map((r) => ({ ...r, matchedBy: "FK" as const })),
    ...nameReviews.map((r) => ({ ...r, matchedBy: "NAME" as const })),
  ];

  return { contributions, attendance, leaves, reviews };
}

// -----------------------------------------------------------------------------
// Công thức KPI (deterministic) → { value, numerator, denominator, sourceCount,
// sourceQuality, evidence }. evidence = bằng chứng tái lập giá trị (drill-down).
// -----------------------------------------------------------------------------
type Computed = {
  value: number; numerator: number | null; denominator: number | null;
  sourceCount: number; sourceQuality: string; evidence: any;
};

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return Math.round((nums.reduce((s, x) => s + x, 0) / nums.length) * 1000) / 1000;
}

export function computeKpi(code: string, f: EmployeeFacts): Computed | null {
  switch (code) {
    case "sessions_contributed": {
      const ids = Array.from(new Set(f.contributions.map((c) => c.treatmentSessionId)));
      return { value: ids.length, numerator: null, denominator: null, sourceCount: f.contributions.length, sourceQuality: "VERIFIED", evidence: { sessionIds: ids } };
    }
    case "services_performed": {
      const ids = Array.from(new Set(f.contributions.map((c) => c.sessionExecutionItemId).filter((x): x is string => !!x)));
      return { value: ids.length, numerator: null, denominator: null, sourceCount: ids.length, sourceQuality: "VERIFIED", evidence: { executionItemIds: ids } };
    }
    case "treatment_minutes": {
      const lines = f.contributions.map((c) => ({ id: c.id, minutes: c.actualMinutes ?? 0 }));
      const total = lines.reduce((s, x) => s + x.minutes, 0);
      return { value: total, numerator: null, denominator: null, sourceCount: lines.length, sourceQuality: "VERIFIED", evidence: { lines } };
    }
    case "worked_minutes": {
      const rows = f.attendance.map((a) => ({ id: a.id, minutes: a.workedMinutes ?? 0 }));
      const total = rows.reduce((s, x) => s + x.minutes, 0);
      return { value: total, numerator: null, denominator: null, sourceCount: rows.length, sourceQuality: "VERIFIED", evidence: { attendanceIds: rows.map((r) => r.id) } };
    }
    case "attendance_days": {
      const days = Array.from(new Set(f.attendance.filter((a) => a.workedMinutes != null || a.status === "ADJUSTED").map((a) => dateOnly(a.workDate))));
      return { value: days.length, numerator: null, denominator: null, sourceCount: days.length, sourceQuality: "VERIFIED", evidence: { days } };
    }
    case "late_minutes": {
      const total = f.attendance.reduce((s, a) => s + (a.lateMinutes ?? 0), 0);
      return { value: total, numerator: null, denominator: null, sourceCount: f.attendance.length, sourceQuality: "VERIFIED", evidence: { attendanceIds: f.attendance.map((a) => a.id) } };
    }
    case "early_leave_minutes": {
      const total = f.attendance.reduce((s, a) => s + (a.earlyLeaveMinutes ?? 0), 0);
      return { value: total, numerator: null, denominator: null, sourceCount: f.attendance.length, sourceQuality: "VERIFIED", evidence: { attendanceIds: f.attendance.map((a) => a.id) } };
    }
    case "overtime_candidate_minutes": {
      const total = f.attendance.reduce((s, a) => s + (a.overtimeMinutes ?? 0), 0);
      return { value: total, numerator: null, denominator: null, sourceCount: f.attendance.length, sourceQuality: "VERIFIED", evidence: { attendanceIds: f.attendance.map((a) => a.id) } };
    }
    case "approved_leave_days": {
      const ids = f.leaves.map((l) => l.id);
      // Số ngày nghỉ (đếm ngày lịch trong đơn, giới hạn trong kỳ đã lọc ở query).
      const total = f.leaves.reduce((s, l) => {
        const ms = l.toAt.getTime() - l.fromAt.getTime();
        return s + Math.max(1, Math.round(ms / 86_400_000));
      }, 0);
      return { value: total, numerator: null, denominator: null, sourceCount: ids.length, sourceQuality: "VERIFIED", evidence: { leaveIds: ids } };
    }
    case "incident_count": {
      const sessions = Array.from(new Map(f.contributions.map((c) => [c.session.id, c.session])).values());
      const withIncident = sessions.filter((s) => s.incident != null);
      return { value: withIncident.length, numerator: null, denominator: null, sourceCount: withIncident.length, sourceQuality: "VERIFIED", evidence: { sessionIds: withIncident.map((s) => s.id) } };
    }
    case "avg_technician_score": {
      const scored = f.reviews.filter((r) => (r.technicianScore ?? 0) > 0);
      const q = reviewQuality(f.reviews);
      return { value: avg(scored.map((r) => r.technicianScore!)) ?? 0, numerator: scored.reduce((s, r) => s + r.technicianScore!, 0), denominator: scored.length || null, sourceCount: scored.length, sourceQuality: q, evidence: { reviewIds: scored.map((r) => r.id), matchedBy: f.reviews.map((r) => r.matchedBy) } };
    }
    case "avg_satisfaction": {
      const scored = f.reviews.filter((r) => (r.satisfactionScore ?? 0) > 0);
      const q = reviewQuality(f.reviews);
      return { value: avg(scored.map((r) => r.satisfactionScore!)) ?? 0, numerator: scored.reduce((s, r) => s + r.satisfactionScore!, 0), denominator: scored.length || null, sourceCount: scored.length, sourceQuality: q, evidence: { reviewIds: scored.map((r) => r.id) } };
    }
    case "review_count": {
      const q = reviewQuality(f.reviews);
      return { value: f.reviews.length, numerator: null, denominator: null, sourceCount: f.reviews.length, sourceQuality: q, evidence: { reviewIds: f.reviews.map((r) => r.id) } };
    }
    default:
      return null; // KPI chưa hỗ trợ công thức → bỏ qua (không bịa số).
  }
}

/** Chất lượng nguồn review: FK all → VERIFIED; có name-match → LEGACY_NAME_MATCH; rỗng → INSUFFICIENT. */
function reviewQuality(reviews: EmployeeFacts["reviews"]): string {
  if (!reviews.length) return "INSUFFICIENT";
  return reviews.some((r) => r.matchedBy === "NAME") ? "LEGACY_NAME_MATCH" : "VERIFIED";
}

// -----------------------------------------------------------------------------
// Sinh mã kỳ + xác định tập nhân sự ứng viên.
// -----------------------------------------------------------------------------
export async function nextKpiPeriodCode(): Promise<string> {
  const count = await prisma.kpiPeriod.count();
  return sequentialCode("KP", count);
}

async function candidateEmployees(bounds: ReturnType<typeof periodBounds>, branchId: string | null) {
  const branchFilter = branchId ? { branchId } : {};
  // Nhân sự đang hoạt động HOẶC có FACT trong kỳ.
  const [active, contribEmp, attEmp] = await Promise.all([
    prisma.employee.findMany({ where: { status: "ACTIVE" }, select: { id: true, fullName: true } }),
    prisma.sessionStaffContribution.findMany({
      where: { ...effectiveContributionWhere(), ...branchFilter, OR: [{ startedAt: { gte: bounds.startInstant, lte: bounds.endInstant } }, { AND: [{ startedAt: null }, { createdAt: { gte: bounds.startInstant, lte: bounds.endInstant } }] }] },
      select: { employeeId: true }, distinct: ["employeeId"],
    }),
    prisma.attendanceRecord.findMany({
      where: { status: { in: ["COMPLETED", "ADJUSTED"] }, ...branchFilter, workDate: { gte: new Date(`${bounds.startStr}T00:00:00.000Z`), lte: new Date(`${bounds.endStr}T00:00:00.000Z`) } },
      select: { employeeId: true }, distinct: ["employeeId"],
    }),
  ]);
  const ids = new Set<string>(active.map((e) => e.id));
  contribEmp.forEach((c) => ids.add(c.employeeId));
  attEmp.forEach((a) => ids.add(a.employeeId));
  const emps = await prisma.employee.findMany({ where: { id: { in: Array.from(ids) } }, select: { id: true, fullName: true } });
  return emps;
}

/** Map tên → có DUY NHẤT không (chống quy nhầm review name-based). */
async function buildNameUniqueMap(): Promise<Map<string, boolean>> {
  const all = await prisma.employee.findMany({ select: { fullName: true } });
  const counts = new Map<string, number>();
  for (const e of all) counts.set(e.fullName, (counts.get(e.fullName) ?? 0) + 1);
  const uniq = new Map<string, boolean>();
  counts.forEach((c, name) => uniq.set(name, c === 1));
  return uniq;
}

// -----------------------------------------------------------------------------
// Tính kỳ → snapshot (supersede bản CURRENT cũ; append-only version++).
// -----------------------------------------------------------------------------
export async function calculatePeriod(session: SessionPayload, periodId: string): Promise<{ employees: number; snapshots: number; version: number }> {
  const period = await prisma.kpiPeriod.findUnique({ where: { id: periodId } });
  if (!period) throw new KpiError("Không tìm thấy kỳ KPI", 404);
  if (period.status === "LOCKED") throw new KpiError("Kỳ đã KHÓA — không thể tính lại (bất biến lịch sử)", 409);

  await ensureKpiDefinitions();
  const defs = await prisma.kpiDefinition.findMany({ where: { isActive: true, code: { in: Array.from(SUPPORTED_KPI_CODES) } } });
  const bounds = periodBounds(period);
  const emps = await candidateEmployees(bounds, period.branchId);
  const nameUniq = await buildNameUniqueMap();

  // Version cho lần tính này (supersede bản cũ).
  const prevMax = await prisma.employeeKpiSnapshot.aggregate({ where: { kpiPeriodId: periodId }, _max: { version: true } });
  const version = (prevMax._max.version ?? 0) + 1;
  const isRecompute = version > 1;

  let snapshotCount = 0;
  await prisma.$transaction(async (tx) => {
    // Supersede toàn bộ CURRENT (append-only, không xóa).
    await tx.employeeKpiSnapshot.updateMany({ where: { kpiPeriodId: periodId, status: "CURRENT" }, data: { status: "SUPERSEDED" } });

    for (const emp of emps) {
      const facts = await loadEmployeeFacts(emp, bounds, period.branchId, nameUniq.get(emp.fullName) ?? false);
      for (const def of defs) {
        const c = computeKpi(def.code, facts);
        if (!c) continue;
        await tx.employeeKpiSnapshot.create({
          data: {
            kpiPeriodId: periodId, employeeId: emp.id, kpiDefinitionId: def.id,
            value: new Prisma.Decimal(c.value), numerator: c.numerator != null ? new Prisma.Decimal(c.numerator) : null,
            denominator: c.denominator != null ? new Prisma.Decimal(c.denominator) : null,
            sourceCount: c.sourceCount, sourceQuality: c.sourceQuality as any,
            calculationSnapshot: { code: def.code, calculationType: def.calculationType, formula: def.name, value: c.value, evidence: c.evidence, periodStart: bounds.startStr, periodEnd: bounds.endStr, branchId: period.branchId ?? null } as any,
            branchSnapshot: period.branchId ?? null, version, status: "CURRENT", createdBy: session.name ?? session.email ?? null,
          },
        });
        snapshotCount++;
      }
    }

    await tx.kpiPeriod.update({
      where: { id: periodId },
      data: { status: period.status === "REVIEWED" ? "REVIEWED" : "CALCULATED", calculatedAt: now(), calculatedBy: session.name ?? session.email ?? null },
    });
  });

  await auditLog({ userId: session.userId, action: isRecompute ? "KPI_PERIOD_RECALCULATED" : "KPI_PERIOD_CALCULATED", entityType: "KpiPeriod", entityId: periodId, changes: { version, employees: emps.length, snapshots: snapshotCount } });
  return { employees: emps.length, snapshots: snapshotCount, version };
}

/** Khóa kỳ → snapshot BẤT BIẾN. */
export async function lockPeriod(session: SessionPayload, periodId: string): Promise<void> {
  const period = await prisma.kpiPeriod.findUnique({ where: { id: periodId } });
  if (!period) throw new KpiError("Không tìm thấy kỳ KPI", 404);
  if (period.status === "LOCKED") throw new KpiError("Kỳ đã KHÓA", 409);
  if (period.status === "DRAFT") throw new KpiError("Cần TÍNH kỳ trước khi khóa", 409);
  await prisma.$transaction(async (tx) => {
    await tx.employeeKpiSnapshot.updateMany({ where: { kpiPeriodId: periodId, status: "CURRENT" }, data: { lockedAt: now() } });
    await tx.kpiPeriod.update({ where: { id: periodId }, data: { status: "LOCKED", lockedAt: now(), lockedBy: session.name ?? session.email ?? null } });
  });
  await auditLog({ userId: session.userId, action: "KPI_PERIOD_LOCKED", entityType: "KpiPeriod", entityId: periodId, changes: {} });
}
