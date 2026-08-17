export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePermission, getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { auditLog, canSeeFinance } from "@/lib/clinic";
import { recommendedUpdateSchema } from "@/lib/clinic-validation";
import { updateRecommendedVersion, maskRecommended } from "@/lib/recommended-price";

// GET /api/recommended-prices/[id] → chi tiết 1 version (kèm dịch vụ). Cost/margin mask theo finance.read.
export const GET = handle(async (_req, { params }) => {
  await requirePermission(PERMISSIONS.PRICEFLOOR_READ);
  const session = await getSession();
  const canSee = canSeeFinance(session);
  const v = await prisma.serviceRecommendedPriceVersion.findUnique({
    where: { id: params.id },
    include: { service: { select: { id: true, code: true, name: true, standardPrice: true } } },
  });
  if (!v) return fail(404, "Không tìm thấy version giá đề xuất");
  return ok(maskRecommended(v as any, canSee));
});

// PATCH /api/recommended-prices/[id] → sửa DRAFT (biên mục tiêu/làm tròn) + tính lại. Published → 409.
export const PATCH = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.PRICEFLOOR_WRITE);
  const canSee = canSeeFinance(session);
  const patch = recommendedUpdateSchema.parse(await req.json());
  const version = await updateRecommendedVersion(params.id, patch);
  await auditLog({
    userId: session.userId,
    action: "RECOMMENDED_PRICE_RECALCULATED",
    entityType: "ServiceRecommendedPriceVersion",
    entityId: version.id,
    changes: { recommendedPrice: Number(version.calculatedRecommendedPrice), targetMarginPercent: Number(version.targetMarginPercent) },
  });
  return ok(maskRecommended(version as any, canSee));
});
