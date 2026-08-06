export const dynamic = "force-dynamic";

import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { approveOutbound } from "@/lib/outbound-service";

export const POST = handle(async (_req, { params }: { params: { id: string } }) => {
  const session = await requirePermission(PERMISSIONS.OUTBOUND_APPROVE);
  const order = await approveOutbound(params.id, session.userId);
  return ok(order);
});
