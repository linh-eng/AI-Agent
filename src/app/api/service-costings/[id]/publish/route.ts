export const dynamic = "force-dynamic";

import { ok, handle } from "@/lib/api";
import { requirePermission, getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { auditLog, canSeeFinance } from "@/lib/clinic";
import { publishCostingVersion, maskCosting } from "@/lib/service-costing";

// POST /api/service-costings/[id]/publish → DRAFT → PUBLISHED, đông cứng snapshot.
export const POST = handle(async (_req, { params }) => {
  const session = await requirePermission(PERMISSIONS.PRICEFLOOR_WRITE);
  const canSee = canSeeFinance(session);
  const { version, warnings } = await publishCostingVersion(params.id, session.email);
  await auditLog({
    userId: session.userId,
    action: "SERVICE_COSTING_PUBLISHED",
    entityType: "ServiceCostingVersion",
    entityId: version.id,
    changes: {
      serviceId: version.serviceId,
      version: version.version,
      totalEstimatedCost: version.totalEstimatedCost,
      supersedesId: version.supersedesId,
    },
  });
  return ok({ ...maskCosting(version as any, canSee), warnings });
});
