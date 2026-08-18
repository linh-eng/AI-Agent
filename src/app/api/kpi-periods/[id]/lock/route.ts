export const dynamic = "force-dynamic";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { lockPeriod } from "@/lib/kpi";

// POST — khóa kỳ (attendance.write). Snapshot trở thành BẤT BIẾN.
export const POST = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.ATTENDANCE_WRITE);
  await lockPeriod(session, params.id);
  return ok({ locked: true });
});
