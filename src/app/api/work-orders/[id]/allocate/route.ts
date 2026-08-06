export const dynamic = "force-dynamic";

import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { workOrderAllocateSchema } from "@/lib/validation";
import { allocateWorkOrder } from "@/lib/workorder-service";

export const POST = handle(async (req, { params }: { params: { id: string } }) => {
  const session = await requirePermission(PERMISSIONS.WORKORDER_WRITE);
  const input = workOrderAllocateSchema.parse(await req.json());
  const result = await allocateWorkOrder(params.id, input, session.userId);
  return ok(result);
});
