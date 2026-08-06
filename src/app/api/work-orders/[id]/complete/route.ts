export const dynamic = "force-dynamic";

import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { workOrderCompleteSchema } from "@/lib/validation";
import { completeWorkOrder } from "@/lib/workorder-service";

export const POST = handle(async (req, { params }: { params: { id: string } }) => {
  const session = await requirePermission(PERMISSIONS.WORKORDER_WRITE);
  const input = workOrderCompleteSchema.parse(await req.json());
  const result = await completeWorkOrder(params.id, input, session.userId);
  return ok(result);
});
