export const dynamic = "force-dynamic";

import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { submitOutbound } from "@/lib/outbound-service";

export const POST = handle(async (_req, { params }: { params: { id: string } }) => {
  await requirePermission(PERMISSIONS.OUTBOUND_WRITE);
  const order = await submitOutbound(params.id);
  return ok(order);
});
