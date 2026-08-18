export const dynamic = "force-dynamic";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { calculatePeriod } from "@/lib/kpi";

// POST — tính lại (idempotent; supersede bản CURRENT cũ; version++). Chặn khi LOCKED.
export const POST = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.ATTENDANCE_WRITE);
  const res = await calculatePeriod(session, params.id);
  return ok(res);
});
