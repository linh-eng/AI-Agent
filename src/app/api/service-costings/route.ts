export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission, getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { auditLog, canSeeFinance } from "@/lib/clinic";
import { costingCreateSchema } from "@/lib/clinic-validation";
import { createCostingVersion, maskCosting } from "@/lib/service-costing";

// GET /api/service-costings?serviceId=  → danh sách version giá vốn của 1 dịch vụ.
// Quyền đọc: pricefloor.read. Số liệu cost mask theo finance.read (PH1 §14).
export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.PRICEFLOOR_READ);
  const session = await getSession();
  const canSee = canSeeFinance(session);
  const { searchParams } = new URL(req.url);
  const serviceId = searchParams.get("serviceId");
  if (serviceId) {
    const versions = await prisma.serviceCostingVersion.findMany({
      where: { serviceId },
      orderBy: { version: "desc" },
    });
    return ok(versions.map((v) => maskCosting(v as any, canSee)));
  }
  // IA-PH2 — chế độ TỔNG HỢP TOÀN CỤC (read-only): mỗi dịch vụ + version giá vốn.
  // Chỉ COMPOSE/ĐỌC dữ liệu sẵn có (không thêm entity/logic); mask theo finance.read.
  const services = await prisma.service.findMany({
    where: { costingVersions: { some: {} } },
    orderBy: { name: "asc" },
    select: {
      id: true, code: true, name: true, standardPrice: true,
      costingVersions: { orderBy: { version: "desc" } },
    },
  });
  const rows = services.map((s) => {
    const published = s.costingVersions.find((v) => v.status === "PUBLISHED") ?? null;
    const latest = s.costingVersions[0] ?? null;
    return {
      serviceId: s.id,
      serviceCode: s.code,
      serviceName: s.name,
      standardPrice: s.standardPrice == null ? null : Number(s.standardPrice),
      versionCount: s.costingVersions.length,
      publishedVersion: published ? maskCosting(published as any, canSee) : null,
      latestVersion: latest ? maskCosting(latest as any, canSee) : null,
    };
  });
  return ok(rows);
});

// POST /api/service-costings  → tạo version DRAFT (tính từ nguồn LIVE).
// Quyền: pricefloor.write. Trả kèm warnings (thiếu cost/phí).
export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.PRICEFLOOR_WRITE);
  const canSee = canSeeFinance(session);
  const input = costingCreateSchema.parse(await req.json());
  const { version, warnings } = await createCostingVersion({ ...input, createdBy: session.email });
  await auditLog({
    userId: session.userId,
    action: "SERVICE_COSTING_CREATED",
    entityType: "ServiceCostingVersion",
    entityId: version.id,
    changes: { serviceId: version.serviceId, version: version.version, totalEstimatedCost: version.totalEstimatedCost },
  });
  return created({ ...maskCosting(version as any, canSee), warnings });
});
