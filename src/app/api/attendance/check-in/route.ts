export const dynamic = "force-dynamic";
import { created, handle } from "@/lib/api";
import { requireAuth } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { attendanceCheckInSchema } from "@/lib/clinic-validation";
import { checkIn } from "@/lib/attendance-service";

// POST /api/attendance/check-in — self (không employeeId) hoặc quản lý (attendance.write).
export const POST = handle(async (req) => {
  const session = await requireAuth();
  const canWrite = session.permissions.includes(PERMISSIONS.ATTENDANCE_WRITE);
  const input = attendanceCheckInSchema.parse(await req.json());
  const rec = await checkIn(session, input, canWrite);
  return created(rec);
});
