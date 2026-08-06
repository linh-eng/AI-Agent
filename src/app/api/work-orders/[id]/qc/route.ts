export const dynamic = "force-dynamic";

import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { workOrderQcSchema } from "@/lib/validation";
import { qcWorkOrder } from "@/lib/workorder-service";

export const POST = handle(async (req, { params }: { params: { id: string } }) => {
  const session = await requirePermission(PERMISSIONS.QC_WRITE);
  const input = workOrderQcSchema.parse(await req.json());
  const report = await qcWorkOrder(params.id, input, session.userId);
  return ok(report);
});
