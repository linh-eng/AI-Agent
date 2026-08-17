export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePermission, getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { canSeeFinance } from "@/lib/clinic";
import { activeProtocolCostingVersion, activeProtocolFloorVersion, activeProtocolRecommendedVersion, packageRetailComparison } from "@/lib/protocol-pricing";

// GET /api/protocol-pricing/[protocolId] → tổng hợp giá gói cho UI:
//   danh sách version costing/floor/recommended + so sánh Σ retail vs giá gói.
//   Số liệu cost/margin mask theo finance.read.
export const GET = handle(async (_req, { params }) => {
  await requirePermission(PERMISSIONS.PRICEFLOOR_READ);
  const canSee = canSeeFinance(await getSession());
  const protocolId = params.protocolId;
  const protocol = await prisma.brandProtocol.findUnique({ where: { id: protocolId }, select: { id: true, code: true, name: true, compositionMode: true } });
  if (!protocol) return fail(404, "Không tìm thấy protocol");

  const [costings, floors, recommendeds, activeCost, activeFloor, activeRec, cmp] = await Promise.all([
    prisma.protocolCostingVersion.findMany({ where: { protocolId }, orderBy: { version: "desc" } }),
    prisma.protocolFloorPriceVersion.findMany({ where: { protocolId }, orderBy: { version: "desc" } }),
    prisma.protocolRecommendedPriceVersion.findMany({ where: { protocolId }, orderBy: { version: "desc" } }),
    activeProtocolCostingVersion(protocolId),
    activeProtocolFloorVersion(protocolId),
    activeProtocolRecommendedVersion(protocolId),
    packageRetailComparison(protocolId),
  ]);

  return ok({
    protocol,
    costings: costings.map((c) => ({ id: c.id, version: c.version, status: c.status, publishedAt: c.publishedAt, totalEstimatedCost: canSee ? Number(c.totalEstimatedCost) : null, serviceCostTotal: canSee ? Number(c.serviceCostTotal) : null, packageSpecificCost: canSee ? Number(c.packageSpecificCost) : null })),
    floors: floors.map((f) => ({ id: f.id, version: f.version, status: f.status, floorPrice: Number(f.floorPrice), minMarginPercent: canSee ? Number(f.minMarginPercent) : null, protocolCostingVersionId: f.protocolCostingVersionId })),
    recommendeds: recommendeds.map((r) => ({ id: r.id, version: r.version, status: r.status, calculatedRecommendedPrice: Number(r.calculatedRecommendedPrice), targetMarginPercent: canSee ? Number(r.targetMarginPercent) : null, protocolCostingVersionId: r.protocolCostingVersionId })),
    active: {
      costingId: activeCost?.id ?? null,
      totalCost: canSee && activeCost ? Number(activeCost.totalEstimatedCost) : null,
      floorPrice: activeFloor ? Number(activeFloor.floorPrice) : null,
      recommendedPrice: activeRec ? Number(activeRec.calculatedRecommendedPrice) : null,
    },
    comparison: { sumRetail: cmp.sumRetail, packagePrice: cmp.packagePrice, packagePriceType: cmp.packagePriceType, saving: cmp.saving },
    canSeeFinance: canSee,
  });
});
