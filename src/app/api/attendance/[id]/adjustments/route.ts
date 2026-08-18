export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { ok, created, handle, fail } from "@/lib/api";
import { requireAuth, requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { attendanceAdjustmentSchema } from "@/lib/clinic-validation";
import { adjustAttendance } from "@/lib/attendance-service";

export const GET = handle(async (_req, { params }) => {
  await requirePermission(PERMISSIONS.ATTENDANCE_READ);
  const list = await prisma.attendanceAdjustment.findMany({ where: { attendanceRecordId: params.id }, orderBy: { createdAt: "desc" } });
  return ok(list);
});

// POST — nhân viên ĐỀ NGHỊ (self, requested) hoặc quản lý ÁP DỤNG (attendance.write).
export const POST = handle(async (req, { params }) => {
  const session = await requireAuth();
  const canWrite = session.permissions.includes(PERMISSIONS.ATTENDANCE_WRITE);
  const input = attendanceAdjustmentSchema.parse(await req.json());
  const adj = await adjustAttendance(session, params.id, input, canWrite);
  if (!adj) return fail(500, "Không tạo được điều chỉnh");
  return created(adj);
});
