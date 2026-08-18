// =============================================================================
// HR-PH2 — Service chấm công/nghỉ phép: check-in/out, điều chỉnh (append-only),
// void (không hard-delete), đơn nghỉ có duyệt. Self-view theo FK userId.
//  * Chống đua: partial unique index (1 OPEN/nhân sự) → check-in trùng = 409.
//  * KHÔNG hard-delete: sai → VOID; sửa lịch sử → AttendanceAdjustment (before/after).
//  * Nhân viên ĐỀ NGHỊ (không tự duyệt); quản lý (attendance.write) ÁP DỤNG.
// =============================================================================
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { parseVnLocal, vnClock } from "./timezone";
import { computeAttendance } from "./attendance";
import { auditLog } from "./clinic";
import { resolveSelfEmployeeId } from "./hr-self";
import type { SessionPayload } from "./auth";

export class AttendanceError extends Error {
  status: number;
  constructor(message: string, status = 409) { super(message); this.status = status; }
}

type Session = SessionPayload;
const now = () => new Date();
function toInstant(v: string | null | undefined, fallback?: Date): Date {
  if (v == null || v === "") return fallback ?? now();
  return parseVnLocal(v);
}
function localWorkDate(at: Date): Date {
  const c = vnClock(at);
  return parseVnLocal(`${c.year}-${String(c.month).padStart(2, "0")}-${String(c.day).padStart(2, "0")}`);
}

/** Xác định nhân sự đích cho hành động chấm công (ownership FK; quản lý mới thao tác hộ). */
export async function resolveTargetEmployee(session: Session, requestedEmployeeId: string | null | undefined, canWrite: boolean): Promise<string> {
  const selfId = await resolveSelfEmployeeId(session);
  if (requestedEmployeeId) {
    if (canWrite) {
      const e = await prisma.employee.findUnique({ where: { id: requestedEmployeeId }, select: { id: true } });
      if (!e) throw new AttendanceError("Không tìm thấy nhân sự", 404);
      return requestedEmployeeId;
    }
    if (selfId && requestedEmployeeId === selfId) return selfId;
    throw new AttendanceError("Không có quyền thao tác chấm công của nhân sự khác", 403);
  }
  if (!selfId) throw new AttendanceError("Tài khoản chưa liên kết hồ sơ nhân sự", 403);
  return selfId;
}

interface CheckInInput { employeeId?: string | null; workShiftId?: string | null; branchId?: string | null; at?: string | null; source?: string | null; note?: string | null; }
export async function checkIn(session: Session, input: CheckInInput, canWrite: boolean) {
  const employeeId = await resolveTargetEmployee(session, input.employeeId, canWrite);
  const at = toInstant(input.at, now());
  // MANUAL (nhập giờ) chỉ cho quản lý; nhân viên tự chấm = giờ server.
  const source = (input.source as any) ?? (canWrite && input.at ? "MANUAL" : "APP");
  const emp = await prisma.employee.findUnique({ where: { id: employeeId }, select: { branchId: true } });
  let shift: { scheduledStartAt: Date; scheduledEndAt: Date; breakMinutes: number; branchId: string | null } | null = null;
  if (input.workShiftId) {
    const s = await prisma.workShift.findUnique({ where: { id: input.workShiftId } });
    if (!s || s.employeeId !== employeeId) throw new AttendanceError("Ca không hợp lệ", 422);
    shift = { scheduledStartAt: s.scheduledStartAt, scheduledEndAt: s.scheduledEndAt, breakMinutes: s.breakMinutes, branchId: s.branchId };
  }
  const branchId = input.branchId ?? shift?.branchId ?? emp?.branchId ?? null;
  const calc = computeAttendance({ checkInAt: at, scheduledStartAt: shift?.scheduledStartAt, scheduledEndAt: shift?.scheduledEndAt, scheduledBreakMinutes: shift?.breakMinutes });
  try {
    const rec = await prisma.attendanceRecord.create({
      data: {
        employeeId, workShiftId: input.workShiftId ?? null, branchId, workDate: localWorkDate(at),
        checkInAt: at, source, status: "OPEN", note: input.note ?? null,
        scheduledMinutes: calc.scheduledMinutes, lateMinutes: calc.lateMinutes,
        createdBy: session.name ?? session.email ?? null,
      },
    });
    await auditLog({ userId: session.userId, action: "ATTENDANCE_CHECKED_IN", entityType: "AttendanceRecord", entityId: rec.id, changes: { employeeId, at: at.toISOString(), source } });
    return rec;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      throw new AttendanceError("Đang có bản chấm công mở — hãy check-out trước", 409);
    throw e;
  }
}

interface CheckOutInput { attendanceId?: string | null; employeeId?: string | null; at?: string | null; breakMinutesActual?: number; }
export async function checkOut(session: Session, input: CheckOutInput, canWrite: boolean) {
  // Xác định nhân sự đích: nếu chỉ định attendanceId → theo CHỦ của bản ghi (ủy quyền
  // bằng ownership/canWrite); nếu không → bản OPEN của chính mình (self, cần liên kết).
  let employeeId: string;
  if (input.attendanceId) {
    const rec0 = await prisma.attendanceRecord.findUnique({ where: { id: input.attendanceId }, select: { employeeId: true } });
    if (!rec0) throw new AttendanceError("Không tìm thấy bản chấm công", 404);
    const selfId = await resolveSelfEmployeeId(session);
    if (!canWrite && !(selfId && rec0.employeeId === selfId)) throw new AttendanceError("Không có quyền check-out bản ghi này", 403);
    employeeId = rec0.employeeId;
  } else {
    employeeId = await resolveTargetEmployee(session, input.employeeId, canWrite);
  }
  return prisma.$transaction(async (tx) => {
    // Khóa bản OPEN (chống double-checkout đồng thời).
    const target = input.attendanceId
      ? await tx.$queryRaw<{ id: string }[]>`SELECT id FROM attendance_records WHERE id = ${input.attendanceId} AND "employeeId" = ${employeeId} AND status = 'OPEN' FOR UPDATE`
      : await tx.$queryRaw<{ id: string }[]>`SELECT id FROM attendance_records WHERE "employeeId" = ${employeeId} AND status = 'OPEN' ORDER BY "checkInAt" DESC LIMIT 1 FOR UPDATE`;
    if (target.length === 0) throw new AttendanceError("Không có bản chấm công đang mở để check-out", 409);
    const rec = await tx.attendanceRecord.findUnique({ where: { id: target[0].id }, include: { workShift: true } });
    if (!rec) throw new AttendanceError("Không tìm thấy bản chấm công", 404);
    const at = toInstant(input.at, now());
    if (rec.checkInAt && at.getTime() < rec.checkInAt.getTime()) throw new AttendanceError("Giờ check-out không thể trước giờ check-in", 422);
    const calc = computeAttendance({
      checkInAt: rec.checkInAt, checkOutAt: at, breakMinutesActual: input.breakMinutesActual ?? rec.breakMinutesActual,
      scheduledStartAt: rec.workShift?.scheduledStartAt, scheduledEndAt: rec.workShift?.scheduledEndAt, scheduledBreakMinutes: rec.workShift?.breakMinutes,
    });
    const updated = await tx.attendanceRecord.update({
      where: { id: rec.id },
      data: {
        checkOutAt: at, status: "COMPLETED", breakMinutesActual: input.breakMinutesActual ?? rec.breakMinutesActual,
        workedMinutes: calc.workedMinutes, scheduledMinutes: calc.scheduledMinutes, overtimeMinutes: calc.overtimeMinutes,
        lateMinutes: calc.lateMinutes, earlyLeaveMinutes: calc.earlyLeaveMinutes,
      },
    });
    await auditLog({ userId: session.userId, action: "ATTENDANCE_CHECKED_OUT", entityType: "AttendanceRecord", entityId: rec.id, changes: { at: at.toISOString(), workedMinutes: calc.workedMinutes } });
    return updated;
  });
}

interface ManualInput { employeeId: string; workShiftId?: string | null; branchId?: string | null; checkInAt: string; checkOutAt?: string | null; breakMinutesActual?: number; note?: string | null; }
export async function manualRecord(session: Session, input: ManualInput) {
  const checkInAt = parseVnLocal(input.checkInAt);
  const checkOutAt = input.checkOutAt ? parseVnLocal(input.checkOutAt) : null;
  if (checkOutAt && checkOutAt.getTime() < checkInAt.getTime()) throw new AttendanceError("Giờ check-out không thể trước giờ check-in", 422);
  const emp = await prisma.employee.findUnique({ where: { id: input.employeeId }, select: { id: true, branchId: true } });
  if (!emp) throw new AttendanceError("Không tìm thấy nhân sự", 404);
  let shift: any = null;
  if (input.workShiftId) shift = await prisma.workShift.findUnique({ where: { id: input.workShiftId } });
  const calc = computeAttendance({ checkInAt, checkOutAt, breakMinutesActual: input.breakMinutesActual ?? 0, scheduledStartAt: shift?.scheduledStartAt, scheduledEndAt: shift?.scheduledEndAt, scheduledBreakMinutes: shift?.breakMinutes });
  const rec = await prisma.attendanceRecord.create({
    data: {
      employeeId: input.employeeId, workShiftId: input.workShiftId ?? null, branchId: input.branchId ?? shift?.branchId ?? emp.branchId ?? null,
      workDate: localWorkDate(checkInAt), checkInAt, checkOutAt, breakMinutesActual: input.breakMinutesActual ?? 0,
      source: "MANUAL", status: checkOutAt ? "COMPLETED" : "OPEN", note: input.note ?? null,
      workedMinutes: calc.workedMinutes, scheduledMinutes: calc.scheduledMinutes, overtimeMinutes: calc.overtimeMinutes,
      lateMinutes: calc.lateMinutes, earlyLeaveMinutes: calc.earlyLeaveMinutes, createdBy: session.name ?? session.email ?? null,
    },
  });
  await auditLog({ userId: session.userId, action: "ATTENDANCE_CHECKED_IN", entityType: "AttendanceRecord", entityId: rec.id, changes: { manual: true, employeeId: input.employeeId } });
  return rec;
}

function snapshot(rec: any) {
  return { checkInAt: rec.checkInAt, checkOutAt: rec.checkOutAt, breakMinutesActual: rec.breakMinutesActual, branchId: rec.branchId, workedMinutes: rec.workedMinutes, status: rec.status };
}

interface AdjustInput { reason: string; requested?: boolean; checkInAt?: string | null; checkOutAt?: string | null; breakMinutesActual?: number; branchId?: string | null; }
export async function adjustAttendance(session: Session, attendanceId: string, input: AdjustInput, canWrite: boolean) {
  const selfId = await resolveSelfEmployeeId(session);
  const rec = await prisma.attendanceRecord.findUnique({ where: { id: attendanceId }, include: { workShift: true } });
  if (!rec) throw new AttendanceError("Không tìm thấy bản chấm công", 404);
  const isOwner = selfId && rec.employeeId === selfId;
  if (!canWrite && !isOwner) throw new AttendanceError("Không có quyền điều chỉnh chấm công", 403);
  // Nhân viên (không attendance.write) → CHỈ được ĐỀ NGHỊ (không tự duyệt). Quản lý áp dụng.
  const isRequestOnly = !canWrite || input.requested === true;

  const before = snapshot(rec);
  const nextCheckIn = input.checkInAt !== undefined && input.checkInAt !== null ? parseVnLocal(input.checkInAt) : rec.checkInAt;
  const nextCheckOut = input.checkOutAt !== undefined && input.checkOutAt !== null ? parseVnLocal(input.checkOutAt) : rec.checkOutAt;
  const nextBreak = input.breakMinutesActual ?? rec.breakMinutesActual;
  const nextBranch = input.branchId !== undefined ? input.branchId : rec.branchId;
  if (nextCheckIn && nextCheckOut && nextCheckOut.getTime() < nextCheckIn.getTime()) throw new AttendanceError("Giờ check-out không thể trước giờ check-in", 422);
  const calc = computeAttendance({ checkInAt: nextCheckIn, checkOutAt: nextCheckOut, breakMinutesActual: nextBreak, scheduledStartAt: rec.workShift?.scheduledStartAt, scheduledEndAt: rec.workShift?.scheduledEndAt, scheduledBreakMinutes: rec.workShift?.breakMinutes });
  const after = { checkInAt: nextCheckIn, checkOutAt: nextCheckOut, breakMinutesActual: nextBreak, branchId: nextBranch, workedMinutes: calc.workedMinutes, status: nextCheckOut ? "ADJUSTED" : rec.status };

  return prisma.$transaction(async (tx) => {
    const adj = await tx.attendanceAdjustment.create({
      data: {
        attendanceRecordId: rec.id, beforeSnapshot: before as any, afterSnapshot: after as any, reason: input.reason,
        requestedBy: isOwner ? (session.name ?? session.email ?? null) : null,
        changedBy: isRequestOnly ? null : (session.name ?? session.email ?? null),
        status: isRequestOnly ? "REQUESTED" : "APPLIED",
      },
    });
    if (!isRequestOnly) {
      await tx.attendanceRecord.update({
        where: { id: rec.id },
        data: {
          checkInAt: nextCheckIn, checkOutAt: nextCheckOut, breakMinutesActual: nextBreak, branchId: nextBranch, status: "ADJUSTED",
          workedMinutes: calc.workedMinutes, scheduledMinutes: calc.scheduledMinutes, overtimeMinutes: calc.overtimeMinutes,
          lateMinutes: calc.lateMinutes, earlyLeaveMinutes: calc.earlyLeaveMinutes,
        },
      });
    }
    await auditLog({ userId: session.userId, action: isRequestOnly ? "ATTENDANCE_ADJUSTMENT_REQUESTED" : "ATTENDANCE_ADJUSTED", entityType: "AttendanceRecord", entityId: rec.id, changes: { adjustmentId: adj.id, reason: input.reason, before, after } });
    return adj;
  });
}

export async function voidAttendance(session: Session, attendanceId: string, reason: string) {
  const rec = await prisma.attendanceRecord.findUnique({ where: { id: attendanceId } });
  if (!rec) throw new AttendanceError("Không tìm thấy bản chấm công", 404);
  if (rec.status === "VOIDED") throw new AttendanceError("Bản chấm công đã bị hủy trước đó", 409);
  const updated = await prisma.attendanceRecord.update({
    where: { id: attendanceId }, data: { status: "VOIDED", voidReason: reason, voidedBy: session.name ?? session.email ?? null, voidedAt: now() },
  });
  await auditLog({ userId: session.userId, action: "ATTENDANCE_VOIDED", entityType: "AttendanceRecord", entityId: attendanceId, changes: { reason } });
  return updated;
}

// -----------------------------------------------------------------------------
// Đơn nghỉ có duyệt (EmployeeLeave + status lifecycle) — KHÔNG hard-delete.
// -----------------------------------------------------------------------------
interface LeaveReqInput { employeeId?: string | null; type: string; fromAt: Date; toAt: Date; isPaid?: boolean; reason?: string | null; autoApprove?: boolean; }
export async function createLeaveRequest(session: Session, input: LeaveReqInput, canWrite: boolean) {
  const employeeId = await resolveTargetEmployee(session, input.employeeId, canWrite);
  if (input.toAt.getTime() < input.fromAt.getTime()) throw new AttendanceError("Khoảng nghỉ không hợp lệ", 422);
  const actor = session.name ?? session.email ?? null;
  const approved = !!(input.autoApprove && canWrite);
  const row = await prisma.employeeLeave.create({
    data: {
      employeeId, type: input.type as any, fromAt: input.fromAt, toAt: input.toAt, reason: input.reason ?? null,
      isPaid: input.isPaid ?? true, status: approved ? "APPROVED" : "PENDING",
      requestedBy: actor, requestedAt: now(), createdBy: actor,
      ...(approved ? { approvedBy: actor, approvedAt: now() } : {}),
    },
  });
  await auditLog({ userId: session.userId, action: "LEAVE_REQUESTED", entityType: "EmployeeLeave", entityId: row.id, changes: { employeeId, type: input.type, status: row.status } });
  if (approved) await auditLog({ userId: session.userId, action: "LEAVE_APPROVED", entityType: "EmployeeLeave", entityId: row.id, changes: { auto: true } });
  return row;
}

export async function decideLeave(session: Session, leaveId: string, decision: "APPROVED" | "REJECTED", reason?: string | null) {
  const row = await prisma.employeeLeave.findUnique({ where: { id: leaveId } });
  if (!row) throw new AttendanceError("Không tìm thấy đơn nghỉ", 404);
  if (row.status !== "PENDING") throw new AttendanceError("Chỉ duyệt/từ chối được đơn đang chờ", 409);
  const actor = session.name ?? session.email ?? null;
  const updated = await prisma.employeeLeave.update({
    where: { id: leaveId },
    data: decision === "APPROVED"
      ? { status: "APPROVED", approvedBy: actor, approvedAt: now() }
      : { status: "REJECTED", approvedBy: actor, approvedAt: now(), rejectionReason: reason ?? null },
  });
  await auditLog({ userId: session.userId, action: decision === "APPROVED" ? "LEAVE_APPROVED" : "LEAVE_REJECTED", entityType: "EmployeeLeave", entityId: leaveId, changes: { reason: reason ?? null } });
  return updated;
}

export async function cancelLeave(session: Session, leaveId: string, canWrite: boolean) {
  const selfId = await resolveSelfEmployeeId(session);
  const row = await prisma.employeeLeave.findUnique({ where: { id: leaveId } });
  if (!row) throw new AttendanceError("Không tìm thấy đơn nghỉ", 404);
  if (!canWrite && !(selfId && row.employeeId === selfId)) throw new AttendanceError("Không có quyền hủy đơn nghỉ này", 403);
  if (row.status === "CANCELLED" || row.status === "REJECTED") throw new AttendanceError("Đơn đã kết thúc — không thể hủy", 409);
  const updated = await prisma.employeeLeave.update({ where: { id: leaveId }, data: { status: "CANCELLED" } });
  await auditLog({ userId: session.userId, action: "LEAVE_CANCELLED", entityType: "EmployeeLeave", entityId: leaveId, changes: { from: row.status } });
  return updated;
}
