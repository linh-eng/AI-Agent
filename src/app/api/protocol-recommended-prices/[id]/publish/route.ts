export const dynamic = "force-dynamic";

import { ok, handle } from "@/lib/api";
import { requirePermission, getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { auditLog, canSeeFinance } from "@/lib/clinic";
import { publishProtocolRecommendedVersion, maskProtocolRecommended } from "@/lib/protocol-pricing";

export const POST = handle(async (_req, { params }) => {
  const session = await requirePermission(PERMISSIONS.PRICEFLOOR_WRITE);
  const canSee = canSeeFinance(session);
  const version = await publishProtocolRecommendedVersion(params.id, session.email);
  await auditLog({ userId: session.userId, action: "PROTOCOL_RECOMMENDED_PUBLISHED", entityType: "ProtocolRecommendedPriceVersion", entityId: version.id, changes: { protocolId: version.protocolId, version: version.version, recommendedPrice: Number(version.calculatedRecommendedPrice) } });
  return ok(maskProtocolRecommended(version as any, canSee));
});
