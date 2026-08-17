export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle, fail } from "@/lib/api";
import { requirePermission, getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { auditLog, canSeeFinance } from "@/lib/clinic";
import { recommendedCreateSchema } from "@/lib/clinic-validation";
import { createRecommendedVersion, maskRecommended } from "@/lib/recommended-price";

// GET /api/recommended-prices?serviceId= → danh sách version giá đề xuất của 1 dịch vụ.
// Quyền đọc: pricefloor.read. targetMargin/costSnapshot mask theo finance.read (PH3 §15).
export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.PRICEFLOOR_READ);
  const session = await getSession();
  const canSee = canSeeFinance(session);
  const { searchParams } = new URL(req.url);
  const serviceId = searchParams.get("serviceId");
  if (!serviceId) return fail(400, "Thiếu serviceId");
  const versions = await prisma.serviceRecommendedPriceVersion.findMany({ where: { serviceId }, orderBy: { version: "desc" } });
  return ok(versions.map((v) => maskRecommended(v as any, canSee)));
});

// POST /api/recommended-prices → tạo DRAFT từ ServiceCostingVersion PUBLISHED (pricefloor.write).
export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.PRICEFLOOR_WRITE);
  const canSee = canSeeFinance(session);
  const input = recommendedCreateSchema.parse(await req.json());
  const version = await createRecommendedVersion({ ...input, createdBy: session.email });
  await auditLog({
    userId: session.userId,
    action: "RECOMMENDED_PRICE_CREATED",
    entityType: "ServiceRecommendedPriceVersion",
    entityId: version.id,
    changes: { serviceId: version.serviceId, version: version.version, recommendedPrice: Number(version.calculatedRecommendedPrice), serviceCostingVersionId: version.serviceCostingVersionId },
  });
  return created(maskRecommended(version as any, canSee));
});
