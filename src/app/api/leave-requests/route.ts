export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requireAuth } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { leaveRequestCreateSchema } from "@/lib/clinic-validation";
import { createLeaveRequest } from "@/lib/attendance-service";
import { resolveSelfEmployeeId } from "@/lib/hr-self";

// GET — org (attendance.read) xem tất cả; nếu không có quyền → chỉ đơn của CHÍNH MÌNH (self).
export const GET = handle(async (req) => {
  const session = await requireAuth();
  const canRead = session.permissions.includes(PERMISSIONS.ATTENDANCE_READ);
  const p = new URL(req.url).searchParams;
  const status = p.get("status") ?? undefined;
  const employeeId = p.get("employeeId") ?? undefined;
  let where: any = { ...(status ? { status: status as any } : {}), ...(employeeId ? { employeeId } : {}) };
  if (!canRead) {
    const selfId = await resolveSelfEmployeeId(session);
    if (!selfId) return ok([]);
    where = { ...where, employeeId: selfId }; // scope cứng theo self
  }
  const rows = await prisma.employeeLeave.findMany({
    where,
    include: { employee: { select: { code: true, fullName: true } } },
    orderBy: [{ requestedAt: "desc" }, { fromAt: "desc" }],
    take: 500,
  });
  return ok(rows);
});

// POST — nhân viên tạo đơn (self, PENDING) hoặc quản lý tạo (autoApprove nếu attendance.write).
export const POST = handle(async (req) => {
  const session = await requireAuth();
  const canWrite = session.permissions.includes(PERMISSIONS.ATTENDANCE_WRITE);
  const input = leaveRequestCreateSchema.parse(await req.json());
  const row = await createLeaveRequest(session, input, canWrite);
  return created(row);
});
