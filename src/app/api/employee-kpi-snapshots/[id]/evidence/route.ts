export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { ok, fail, handle } from "@/lib/api";
import { requireAuth } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { isSelfEmployee } from "@/lib/hr-self";

// GET — drill-down bằng chứng: calculationSnapshot + bản ghi nguồn (contribution/
// attendance/review). attendance.read HOẶC chính chủ (self FK). Ngược lại 403/404.
export const GET = handle(async (req, { params }) => {
  const session = await requireAuth();
  const snap = await prisma.employeeKpiSnapshot.findUnique({
    where: { id: params.id },
    include: { definition: { select: { code: true, name: true, unit: true } }, employee: { select: { code: true, fullName: true } } },
  });
  if (!snap) return fail(404, "Không tìm thấy snapshot");
  const canRead = session.permissions.includes(PERMISSIONS.ATTENDANCE_READ);
  if (!canRead && !(await isSelfEmployee(session, snap.employeeId))) return fail(403, "Không có quyền xem bằng chứng KPI");

  const cs: any = snap.calculationSnapshot ?? {};
  const ev: any = cs.evidence ?? {};
  const records: any = {};
  if (Array.isArray(ev.sessionIds) && ev.sessionIds.length) {
    records.sessions = await prisma.treatmentSession.findMany({ where: { id: { in: ev.sessionIds } }, select: { id: true, code: true, performedAt: true, incident: true } });
  }
  if (Array.isArray(ev.lines) && ev.lines.length) {
    const ids = ev.lines.map((l: any) => l.id);
    records.contributions = await prisma.sessionStaffContribution.findMany({ where: { id: { in: ids } }, select: { id: true, serviceNameSnapshot: true, actualMinutes: true, contributionTypeCode: true, treatmentSessionId: true } });
  }
  if (Array.isArray(ev.executionItemIds) && ev.executionItemIds.length) {
    records.executionItems = await prisma.sessionExecutionItem.findMany({ where: { id: { in: ev.executionItemIds } }, select: { id: true, serviceId: true, sessionId: true } });
  }
  if (Array.isArray(ev.attendanceIds) && ev.attendanceIds.length) {
    records.attendance = await prisma.attendanceRecord.findMany({ where: { id: { in: ev.attendanceIds } }, select: { id: true, workDate: true, workedMinutes: true, lateMinutes: true, earlyLeaveMinutes: true, overtimeMinutes: true } });
  }
  if (Array.isArray(ev.reviewIds) && ev.reviewIds.length) {
    records.reviews = await prisma.sessionReview.findMany({ where: { id: { in: ev.reviewIds } }, select: { id: true, technicianScore: true, satisfactionScore: true, technicianName: true, employeeId: true } });
  }
  if (Array.isArray(ev.leaveIds) && ev.leaveIds.length) {
    records.leaves = await prisma.employeeLeave.findMany({ where: { id: { in: ev.leaveIds } }, select: { id: true, fromAt: true, toAt: true, isPaid: true } });
  }
  return ok({ snapshot: { id: snap.id, value: snap.value, sourceCount: snap.sourceCount, sourceQuality: snap.sourceQuality, definition: snap.definition, employee: snap.employee, lockedAt: snap.lockedAt, version: snap.version }, calculationSnapshot: cs, records, note: snap.lockedAt ? "Kỳ đã khóa — bản ghi nguồn hiển thị trạng thái hiện tại (có thể khác nếu bị sửa sau khi khóa)." : null });
});
