export const dynamic = "force-dynamic";

import { ok, handle } from "@/lib/api";
import { requirePermission, getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { auditLog, canSeeFinance } from "@/lib/clinic";
import { publishRecommendedVersion, maskRecommended } from "@/lib/recommended-price";

// POST /api/recommended-prices/[id]/publish → DRAFT → PUBLISHED (re-validate Floor), đông cứng snapshot.
export const POST = handle(async (_req, { params }) => {
  const session = await requirePermission(PERMISSIONS.PRICEFLOOR_WRITE);
  const canSee = canSeeFinance(session);
  const version = await publishRecommendedVersion(params.id, session.email);
  await auditLog({
    userId: session.userId,
    action: "RECOMMENDED_PRICE_PUBLISHED",
    entityType: "ServiceRecommendedPriceVersion",
    entityId: version.id,
    changes: { serviceId: version.serviceId, version: version.version, recommendedPrice: Number(version.calculatedRecommendedPrice), supersedesId: version.supersedesId },
  });
  if (version.supersedesId)
    await auditLog({ userId: session.userId, action: "RECOMMENDED_PRICE_SUPERSEDED", entityType: "ServiceRecommendedPriceVersion", entityId: version.supersedesId, changes: { supersededByVersion: version.version } });
  return ok(maskRecommended(version as any, canSee));
});
