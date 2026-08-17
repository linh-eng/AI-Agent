export const dynamic = "force-dynamic";

import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { auditLog } from "@/lib/clinic";
import { publishProtocolFloorVersion } from "@/lib/protocol-pricing";

export const POST = handle(async (_req, { params }) => {
  const session = await requirePermission(PERMISSIONS.PRICEFLOOR_WRITE);
  const version = await publishProtocolFloorVersion(params.id, session.email);
  await auditLog({ userId: session.userId, action: "PROTOCOL_FLOOR_PUBLISHED", entityType: "ProtocolFloorPriceVersion", entityId: version.id, changes: { protocolId: version.protocolId, version: version.version, floorPrice: Number(version.floorPrice), supersedesId: version.supersedesId } });
  return ok({ id: version.id, version: version.version, status: version.status, floorPrice: Number(version.floorPrice) });
});
