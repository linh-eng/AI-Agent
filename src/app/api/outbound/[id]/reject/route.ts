export const dynamic = "force-dynamic";

import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { outboundRejectSchema } from "@/lib/validation";
import { rejectOutbound } from "@/lib/outbound-service";

export const POST = handle(async (req, { params }: { params: { id: string } }) => {
  const session = await requirePermission(PERMISSIONS.OUTBOUND_APPROVE);
  const { reason } = outboundRejectSchema.parse(await req.json());
  const order = await rejectOutbound(params.id, reason, session.userId);
  return ok(order);
});
