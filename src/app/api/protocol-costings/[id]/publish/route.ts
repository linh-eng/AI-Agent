export const dynamic = "force-dynamic";

import { ok, handle } from "@/lib/api";
import { requirePermission, getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { auditLog, canSeeFinance } from "@/lib/clinic";
import { publishProtocolCostingVersion, maskProtocolCosting } from "@/lib/protocol-pricing";

export const POST = handle(async (_req, { params }) => {
  const session = await requirePermission(PERMISSIONS.PRICEFLOOR_WRITE);
  const canSee = canSeeFinance(session);
  const version = await publishProtocolCostingVersion(params.id, session.email);
  await auditLog({ userId: session.userId, action: "PROTOCOL_COSTING_PUBLISHED", entityType: "ProtocolCostingVersion", entityId: version.id, changes: { protocolId: version.protocolId, version: version.version, totalEstimatedCost: version.totalEstimatedCost, supersedesId: version.supersedesId } });
  if (version.supersedesId) await auditLog({ userId: session.userId, action: "PROTOCOL_COSTING_SUPERSEDED", entityType: "ProtocolCostingVersion", entityId: version.supersedesId, changes: { supersededByVersion: version.version } });
  return ok(maskProtocolCosting(version as any, canSee));
});
