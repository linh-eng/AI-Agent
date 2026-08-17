export const dynamic = "force-dynamic";

import { ok, handle } from "@/lib/api";
import { requirePermission, getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { auditLog, canSeeFinance } from "@/lib/clinic";
import { recalculateRecommendedVersion, maskRecommended } from "@/lib/recommended-price";

// POST /api/recommended-prices/[id]/recalculate → tính lại DRAFT từ costing + Floor hiện tại.
export const POST = handle(async (_req, { params }) => {
  const session = await requirePermission(PERMISSIONS.PRICEFLOOR_WRITE);
  const canSee = canSeeFinance(session);
  const version = await recalculateRecommendedVersion(params.id);
  await auditLog({
    userId: session.userId,
    action: "RECOMMENDED_PRICE_RECALCULATED",
    entityType: "ServiceRecommendedPriceVersion",
    entityId: version.id,
    changes: { recommendedPrice: Number(version.calculatedRecommendedPrice), trigger: "recalculate" },
  });
  return ok(maskRecommended(version as any, canSee));
});
