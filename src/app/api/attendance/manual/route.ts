export const dynamic = "force-dynamic";
import { created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { attendanceManualSchema } from "@/lib/clinic-validation";
import { manualRecord } from "@/lib/attendance-service";

// Quản lý tạo bản chấm công thủ công (bù công / sửa) — attendance.write.
export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.ATTENDANCE_WRITE);
  const input = attendanceManualSchema.parse(await req.json());
  const rec = await manualRecord(session, input);
  return created(rec);
});
