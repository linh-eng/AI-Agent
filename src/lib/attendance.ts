// =============================================================================
// HR-PH2 — Tính chấm công (deterministic) + sinh ca dated từ mẫu tuần.
//  * Dùng TIMESTAMP (instant), KHÔNG trừ HH:mm thô → cross-midnight an toàn.
//  * Thời lượng (worked/late/early/OT) là hiệu instant → độc lập múi giờ.
//  * Dựng instant từ HH:mm dùng múi giờ nghiệp vụ Asia/Ho_Chi_Minh (UTC+7 cố định,
//    khớp layer timezone dùng chung). Branch.timezone lưu sẵn cho đa-tz phase sau;
//    PH2 vận hành MỘT múi giờ (VN) — ghi rõ giới hạn.
//  * overtimeMinutes ở đây là CANDIDATE tính toán — KHÔNG phải OT được duyệt/trả lương.
// =============================================================================
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { parseVnLocal, vnClock } from "./timezone";

export function diffMinutes(later: Date, earlier: Date): number {
  return Math.round((later.getTime() - earlier.getTime()) / 60000);
}

/** Phút ca theo kế hoạch = (end − start) − nghỉ. Cross-midnight OK (end là instant). */
export function computeScheduledMinutes(start: Date, end: Date, breakMinutes = 0): number {
  return Math.max(0, diffMinutes(end, start) - Math.max(0, breakMinutes));
}

export interface AttendanceCalcInput {
  checkInAt?: Date | null;
  checkOutAt?: Date | null;
  breakMinutesActual?: number;
  scheduledStartAt?: Date | null;
  scheduledEndAt?: Date | null;
  scheduledBreakMinutes?: number;
}
export interface AttendanceCalc {
  workedMinutes: number | null;
  scheduledMinutes: number | null;
  lateMinutes: number | null;
  earlyLeaveMinutes: number | null;
  overtimeMinutes: number | null; // CANDIDATE (không phải OT đã duyệt)
}

/** Công thức chấm công (mục 7). Trả null khi thiếu dữ liệu (chưa check-out / không ca). */
export function computeAttendance(i: AttendanceCalcInput): AttendanceCalc {
  const scheduledMinutes =
    i.scheduledStartAt && i.scheduledEndAt
      ? computeScheduledMinutes(i.scheduledStartAt, i.scheduledEndAt, i.scheduledBreakMinutes ?? 0)
      : null;
  const workedMinutes =
    i.checkInAt && i.checkOutAt
      ? Math.max(0, diffMinutes(i.checkOutAt, i.checkInAt) - Math.max(0, i.breakMinutesActual ?? 0))
      : null;
  const lateMinutes =
    i.scheduledStartAt && i.checkInAt ? Math.max(0, diffMinutes(i.checkInAt, i.scheduledStartAt)) : null;
  const earlyLeaveMinutes =
    i.scheduledEndAt && i.checkOutAt ? Math.max(0, diffMinutes(i.scheduledEndAt, i.checkOutAt)) : null;
  const overtimeMinutes =
    workedMinutes !== null && scheduledMinutes !== null ? Math.max(0, workedMinutes - scheduledMinutes) : null;
  return { workedMinutes, scheduledMinutes, lateMinutes, earlyLeaveMinutes, overtimeMinutes };
}

export type AttendanceFlag =
  | "ON_TIME" | "LATE" | "EARLY_LEAVE" | "ABSENT" | "LEAVE" | "OPEN_ATTENDANCE" | "OVERTIME_CANDIDATE";

/** Cờ vận hành (DERIVED — hiển thị; KHÔNG quy đổi trực tiếp thành tiền lương). */
export function deriveFlags(rec: {
  status: string; checkInAt: Date | null; checkOutAt: Date | null;
  lateMinutes: number | null; earlyLeaveMinutes: number | null; overtimeMinutes: number | null;
}, onApprovedLeave = false): AttendanceFlag[] {
  const flags: AttendanceFlag[] = [];
  if (onApprovedLeave) flags.push("LEAVE");
  if (rec.status === "OPEN") flags.push("OPEN_ATTENDANCE");
  if (!rec.checkInAt && !onApprovedLeave && rec.status !== "OPEN") flags.push("ABSENT");
  if ((rec.lateMinutes ?? 0) > 0) flags.push("LATE");
  if ((rec.earlyLeaveMinutes ?? 0) > 0) flags.push("EARLY_LEAVE");
  if ((rec.overtimeMinutes ?? 0) > 0) flags.push("OVERTIME_CANDIDATE");
  if (rec.checkInAt && rec.checkOutAt && (rec.lateMinutes ?? 0) === 0 && (rec.earlyLeaveMinutes ?? 0) === 0)
    flags.push("ON_TIME");
  return flags;
}

// -----------------------------------------------------------------------------
// Sinh ca dated từ EmployeeSchedule (mẫu tuần) — IDEMPOTENT.
// -----------------------------------------------------------------------------
function pad2(n: number): string { return String(n).padStart(2, "0"); }
function vnDateStr(d: Date): string { const c = vnClock(d); return `${c.year}-${pad2(c.month)}-${pad2(c.day)}`; }

/** Dựng instant bắt đầu/kết thúc từ ngày local + HH:mm (VN). Cross-midnight → +1 ngày. */
export function buildShiftInstants(dateStr: string, startHHmm: string, endHHmm: string): { start: Date; end: Date } {
  const start = parseVnLocal(`${dateStr}T${startHHmm}`);
  let end = parseVnLocal(`${dateStr}T${endHHmm}`);
  if (end.getTime() <= start.getTime()) end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export interface GenerateShiftsInput {
  employeeId: string;
  from: Date; // ngày bắt đầu (local VN)
  to: Date; // ngày kết thúc (bao gồm)
  branchId?: string | null;
  createdBy?: string | null;
}

/**
 * Sinh WorkShift cho từng ngày trong [from,to] khớp EmployeeSchedule (dayOfWeek + hiệu lực).
 * Idempotent: unique một phần (employeeId, workDate, scheduleId) + createMany skipDuplicates →
 * chạy lại KHÔNG trùng, KHÔNG ghi đè ca đã sửa (chỉ tạo khi thiếu; không update).
 * Trả { created, skipped, considered }.
 */
export async function generateShiftsFromSchedule(
  input: GenerateShiftsInput,
  tx: Prisma.TransactionClient = prisma
): Promise<{ created: number; skipped: number; considered: number }> {
  const emp = await tx.employee.findUnique({ where: { id: input.employeeId }, select: { id: true, branchId: true } });
  if (!emp) return { created: 0, skipped: 0, considered: 0 };
  const branchId = input.branchId ?? emp.branchId ?? null;
  const schedules = await tx.employeeSchedule.findMany({ where: { employeeId: input.employeeId } });
  if (schedules.length === 0) return { created: 0, skipped: 0, considered: 0 };

  // Duyệt local VN dates bằng mốc trưa (tránh sai biên nửa đêm; VN không DST).
  const startStr = vnDateStr(input.from);
  const endStr = vnDateStr(input.to);
  let cursor = parseVnLocal(`${startStr}T12:00`);
  const endAnchor = parseVnLocal(`${endStr}T12:00`);
  const rows: Prisma.WorkShiftCreateManyInput[] = [];
  let guard = 0;
  while (cursor.getTime() <= endAnchor.getTime() && guard < 1000) {
    guard++;
    const c = vnClock(cursor);
    const dateStr = `${c.year}-${pad2(c.month)}-${pad2(c.day)}`;
    for (const s of schedules) {
      if (s.dayOfWeek !== c.dow) continue;
      if (s.effectiveFrom && cursor.getTime() < new Date(s.effectiveFrom).getTime()) continue;
      if (s.effectiveTo && cursor.getTime() >= new Date(s.effectiveTo).getTime()) continue;
      const { start, end } = buildShiftInstants(dateStr, s.startTime, s.endTime);
      rows.push({
        employeeId: input.employeeId,
        branchId,
        scheduleId: s.id,
        workDate: parseVnLocal(dateStr), // 00:00Z của ngày local (DATE)
        scheduledStartAt: start,
        scheduledEndAt: end,
        breakMinutes: 0,
        shiftLabel: s.shift ?? null,
        source: "MANUAL",
        status: "SCHEDULED",
        createdBy: input.createdBy ?? null,
      });
    }
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  if (rows.length === 0) return { created: 0, skipped: 0, considered: 0 };
  const res = await tx.workShift.createMany({ data: rows, skipDuplicates: true });
  return { created: res.count, skipped: rows.length - res.count, considered: rows.length };
}

/** Có đơn nghỉ ĐÃ DUYỆT bao trùm thời điểm `at` không (tránh false-absent). */
export async function hasApprovedLeaveAt(employeeId: string, at: Date, tx: Prisma.TransactionClient = prisma): Promise<boolean> {
  const n = await tx.employeeLeave.count({
    where: { employeeId, status: "APPROVED", fromAt: { lte: at }, toAt: { gte: at } },
  });
  return n > 0;
}
