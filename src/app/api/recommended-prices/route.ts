export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
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
  if (serviceId) {
    const versions = await prisma.serviceRecommendedPriceVersion.findMany({ where: { serviceId }, orderBy: { version: "desc" } });
    return ok(versions.map((v) => maskRecommended(v as any, canSee)));
  }
  // IA-PH2 — chế độ TỔNG HỢP TOÀN CỤC (read-only): mỗi dịch vụ + version giá đề xuất.
  // Chỉ COMPOSE/ĐỌC (không thêm entity/logic); targetMargin/costSnapshot mask theo finance.read.
  const services = await prisma.service.findMany({
    where: { recommendedPriceVersions: { some: {} } },
    orderBy: { name: "asc" },
    select: {
      id: true, code: true, name: true, standardPrice: true,
      recommendedPriceVersions: { orderBy: { version: "desc" } },
    },
  });
  const rows = services.map((s) => {
    const published = s.recommendedPriceVersions.find((v) => v.status === "PUBLISHED") ?? null;
    const latest = s.recommendedPriceVersions[0] ?? null;
    return {
      serviceId: s.id,
      serviceCode: s.code,
      serviceName: s.name,
      standardPrice: s.standardPrice == null ? null : Number(s.standardPrice),
      versionCount: s.recommendedPriceVersions.length,
      publishedVersion: published ? maskRecommended(published as any, canSee) : null,
      latestVersion: latest ? maskRecommended(latest as any, canSee) : null,
    };
  });
  return ok(rows);
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
