export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle, fail } from "@/lib/api";
import { requirePermission, requireAuth } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { floorVersionCreateSchema, floorVersionFromCostingSchema } from "@/lib/clinic-validation";
import { canSeeFinance, auditLog } from "@/lib/clinic";
import { createFloorVersion, createFloorVersionFromCosting } from "@/lib/price-floor-service";

// Chi tiết giá sàn của một dịch vụ: tất cả version (kèm dòng chi phí) + đang hiệu lực.
// Cost breakdown chỉ hiện với finance.read.
export const GET = handle(async (_req, { params }) => {
  const session = await requireAuth();
  const fin = canSeeFinance(session);
  if (!fin && !session.permissions.includes(PERMISSIONS.PRICEFLOOR_READ)) return fail(403, "Không có quyền xem giá sàn");

  const service = await prisma.service.findUnique({
    where: { id: params.serviceId },
    include: {
      category: { select: { name: true } },
      floorVersions: { orderBy: { version: "desc" }, include: { lines: { orderBy: { orderIndex: "asc" } } } },
    },
  });
  if (!service) return fail(404, "Không tìm thấy dịch vụ");

  const versions = service.floorVersions.map((v) => {
    const base = {
      id: v.id, version: v.version, status: v.status, method: v.method, minMarginPercent: fin ? Number(v.minMarginPercent) : null,
      manualFloorPrice: v.manualFloorPrice == null ? null : Number(v.manualFloorPrice), roundingUnit: v.roundingUnit,
      floorPrice: Number(v.floorPrice), standardPriceSnapshot: Number(v.standardPriceSnapshot),
      maxDiscount: Number(v.maxDiscount), maxDiscountPercent: Number(v.maxDiscountPercent),
      effectiveFrom: v.effectiveFrom, effectiveTo: v.effectiveTo, changeReason: v.changeReason, note: v.note,
      createdBy: v.createdBy, approvedBy: v.approvedBy, approvedAt: v.approvedAt, createdAt: v.createdAt,
      // PH2 provenance (không nhạy cảm — không phải cost breakdown)
      costSource: v.costSource, serviceCostingVersionId: v.serviceCostingVersionId,
      // cost breakdown nhạy cảm
      totalCost: fin ? Number(v.totalCost) : null,
      breakdown: fin ? { MATERIAL: Number(v.materialCost), STAFF: Number(v.staffCost), MACHINE: Number(v.machineCost), ROOM: Number(v.roomCost), OPERATION: Number(v.operationCost), OTHER: Number(v.otherCost) } : null,
      lines: fin ? v.lines.map((l) => ({ id: l.id, category: l.category, name: l.name, quantity: Number(l.quantity), unit: l.unit, unitCost: Number(l.unitCost), calcType: l.calcType, calcValue: l.calcValue == null ? null : Number(l.calcValue), minutes: l.minutes, amount: Number(l.amount), refId: l.refId, source: l.source, required: l.required, note: l.note, orderIndex: l.orderIndex })) : null,
    };
    return base;
  });

  // PH2 — danh sách version Giá vốn ĐÃ PHÁT HÀNH để tạo Floor mới (chọn nguồn).
  // totalEstimatedCost nhạy cảm → chỉ hiện với finance.read.
  const publishedCostings = await prisma.serviceCostingVersion.findMany({
    where: { serviceId: service.id, status: "PUBLISHED" },
    orderBy: { version: "desc" },
    select: { id: true, version: true, totalEstimatedCost: true, publishedAt: true },
  });

  return ok({
    serviceId: service.id, serviceCode: service.code, serviceName: service.name, category: service.category?.name ?? null,
    standardPrice: Number(service.standardPrice), durationMinutes: service.durationMinutes, canSeeFinance: fin, versions,
    publishedCostings: publishedCostings.map((c) => ({ id: c.id, version: c.version, publishedAt: c.publishedAt, totalEstimatedCost: fin ? Number(c.totalEstimatedCost) : null })),
  });
});

// Tạo version DRAFT mới.
//  - PH2 (KHUYẾN NGHỊ): gửi `serviceCostingVersionId` → tạo từ Giá vốn ĐÃ PHÁT HÀNH
//    (snapshot totalEstimatedCost + MARGIN); KHÔNG nhập lại 6 thành phần chi phí.
//  - LEGACY v2: bỏ trống → dựng cost lines từ định mức/nhân sự dịch vụ (giữ tương thích).
export const POST = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.PRICEFLOOR_WRITE);
  const raw = await req.json();
  if (raw && raw.serviceCostingVersionId) {
    const body = floorVersionFromCostingSchema.parse(raw);
    const version = await createFloorVersionFromCosting({ ...body, serviceId: params.serviceId, createdBy: session.name });
    await auditLog({ userId: session.userId, action: "PRICE_FLOOR_CREATED", entityType: "ServicePriceFloorVersion", entityId: version.id, changes: { serviceId: params.serviceId, version: version.version, floorPrice: Number(version.floorPrice), costSource: "COSTING_VERSION" } });
    await auditLog({ userId: session.userId, action: "PRICE_FLOOR_COSTING_LINKED", entityType: "ServicePriceFloorVersion", entityId: version.id, changes: { serviceCostingVersionId: body.serviceCostingVersionId, totalCost: Number(version.totalCost) } });
    return created(version);
  }
  const body = floorVersionCreateSchema.parse({ ...raw, serviceId: params.serviceId });
  const version = await createFloorVersion({ ...body, createdBy: session.name });
  await auditLog({ userId: session.userId, action: "PRICE_FLOOR_CREATED", entityType: "ServicePriceFloorVersion", entityId: version.id, changes: { serviceId: params.serviceId, version: version.version, floorPrice: Number(version.floorPrice), costSource: "LEGACY_LINES" } });
  return created(version);
});
