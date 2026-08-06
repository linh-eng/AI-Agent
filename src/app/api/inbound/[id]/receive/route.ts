export const dynamic = "force-dynamic";

import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { inboundReceiveSchema } from "@/lib/validation";
import { receiveInbound } from "@/lib/inbound-service";

export const POST = handle(async (req, { params }: { params: { id: string } }) => {
  const session = await requirePermission(PERMISSIONS.INBOUND_WRITE);
  const input = inboundReceiveSchema.parse(await req.json());
  const result = await receiveInbound(params.id, input, session.userId);
  return ok(result);
});
