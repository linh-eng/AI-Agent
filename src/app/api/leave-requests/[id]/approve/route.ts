export const dynamic = "force-dynamic";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { decideLeave } from "@/lib/attendance-service";

export const POST = handle(async (_req, { params }) => {
  const session = await requirePermission(PERMISSIONS.ATTENDANCE_WRITE);
  const row = await decideLeave(session, params.id, "APPROVED");
  return ok(row);
});
