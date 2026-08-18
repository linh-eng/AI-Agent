export const dynamic = "force-dynamic";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { calculatePeriod } from "@/lib/kpi";

// POST — tính KPI cho kỳ (attendance.write). Chặn nếu kỳ đã LOCKED (bất biến).
export const POST = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.ATTENDANCE_WRITE);
  const res = await calculatePeriod(session, params.id);
  return ok(res);
});
