export const dynamic = "force-dynamic";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { attendanceVoidSchema } from "@/lib/clinic-validation";
import { voidAttendance } from "@/lib/attendance-service";

export const POST = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.ATTENDANCE_WRITE);
  const { reason } = attendanceVoidSchema.parse(await req.json());
  const rec = await voidAttendance(session, params.id, reason);
  return ok(rec);
});
