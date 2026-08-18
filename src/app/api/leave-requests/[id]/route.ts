export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requireAuth } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { cancelLeave } from "@/lib/attendance-service";
import { resolveSelfEmployeeId } from "@/lib/hr-self";

export const GET = handle(async (_req, { params }) => {
  const session = await requireAuth();
  const row = await prisma.employeeLeave.findUnique({ where: { id: params.id }, include: { employee: { select: { code: true, fullName: true } } } });
  if (!row) return fail(404, "Không tìm thấy đơn nghỉ");
  const canRead = session.permissions.includes(PERMISSIONS.ATTENDANCE_READ);
  if (!canRead) {
    const selfId = await resolveSelfEmployeeId(session);
    if (!selfId || row.employeeId !== selfId) return fail(404, "Không tìm thấy đơn nghỉ"); // không lộ tồn tại
  }
  return ok(row);
});

// PATCH { action: "cancel" } — hủy đơn (self hoặc attendance.write). KHÔNG hard-delete.
export const PATCH = handle(async (req, { params }) => {
  const session = await requireAuth();
  const canWrite = session.permissions.includes(PERMISSIONS.ATTENDANCE_WRITE);
  const body = await req.json().catch(() => ({}));
  if (body?.action !== "cancel") return fail(422, "Hành động không hợp lệ");
  const row = await cancelLeave(session, params.id, canWrite);
  return ok(row);
});
