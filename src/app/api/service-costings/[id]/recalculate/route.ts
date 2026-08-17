export const dynamic = "force-dynamic";

import { ok, handle } from "@/lib/api";
import { requirePermission, getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { auditLog, canSeeFinance } from "@/lib/clinic";
import { recalculateCostingVersion, maskCosting } from "@/lib/service-costing";

// POST /api/service-costings/[id]/recalculate → tính lại DRAFT từ nguồn LIVE hiện tại.
export const POST = handle(async (_req, { params }) => {
  const session = await requirePermission(PERMISSIONS.PRICEFLOOR_WRITE);
  const canSee = canSeeFinance(session);
  const { version, warnings } = await recalculateCostingVersion(params.id);
  await auditLog({
    userId: session.userId,
    action: "SERVICE_COSTING_RECALCULATED",
    entityType: "ServiceCostingVersion",
    entityId: version.id,
    changes: { totalEstimatedCost: version.totalEstimatedCost, trigger: "recalculate" },
  });
  return ok({ ...maskCosting(version as any, canSee), warnings });
});
