export const dynamic = "force-dynamic";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { leaveDecisionSchema } from "@/lib/clinic-validation";
import { decideLeave } from "@/lib/attendance-service";

export const POST = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.ATTENDANCE_WRITE);
  const { reason } = leaveDecisionSchema.parse(await req.json().catch(() => ({})));
  const row = await decideLeave(session, params.id, "REJECTED", reason);
  return ok(row);
});
