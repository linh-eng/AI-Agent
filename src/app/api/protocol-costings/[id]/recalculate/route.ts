export const dynamic = "force-dynamic";

import { ok, handle } from "@/lib/api";
import { requirePermission, getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { auditLog, canSeeFinance } from "@/lib/clinic";
import { recalculateProtocolCostingVersion, maskProtocolCosting } from "@/lib/protocol-pricing";

export const POST = handle(async (_req, { params }) => {
  const session = await requirePermission(PERMISSIONS.PRICEFLOOR_WRITE);
  const canSee = canSeeFinance(session);
  const { version, warnings } = await recalculateProtocolCostingVersion(params.id);
  await auditLog({ userId: session.userId, action: "PROTOCOL_COSTING_RECALCULATED", entityType: "ProtocolCostingVersion", entityId: version.id, changes: { totalEstimatedCost: version.totalEstimatedCost, trigger: "recalculate" } });
  return ok({ ...maskProtocolCosting(version as any, canSee), warnings });
});
