export const dynamic = "force-dynamic";

import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { outboundShipSchema } from "@/lib/validation";
import { shipOutbound } from "@/lib/outbound-service";

export const POST = handle(async (req, { params }: { params: { id: string } }) => {
  const session = await requirePermission(PERMISSIONS.OUTBOUND_WRITE);
  const input = outboundShipSchema.parse(await req.json());
  // Vượt khóa dự án chỉ hiệu lực khi người thao tác có quyền duyệt xuất
  const canOverride = input.allowProjectOverride && session.permissions.includes(PERMISSIONS.OUTBOUND_APPROVE);
  const result = await shipOutbound(params.id, input, session.userId, canOverride);
  return ok(result);
});
