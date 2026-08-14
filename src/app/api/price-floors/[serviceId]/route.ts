export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle, fail } from "@/lib/api";
import { requirePermission, requireAuth } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { floorVersionCreateSchema } from "@/lib/clinic-validation";
import { canSeeFinance, auditLog } from "@/lib/clinic";
import { createFloorVersion } from "@/lib/price-floor-service";

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
      // cost breakdown nhạy cảm
      totalCost: fin ? Number(v.totalCost) : null,
      breakdown: fin ? { MATERIAL: Number(v.materialCost), STAFF: Number(v.staffCost), MACHINE: Number(v.machineCost), ROOM: Number(v.roomCost), OPERATION: Number(v.operationCost), OTHER: Number(v.otherCost) } : null,
      lines: fin ? v.lines.map((l) => ({ id: l.id, category: l.category, name: l.name, quantity: Number(l.quantity), unit: l.unit, unitCost: Number(l.unitCost), calcType: l.calcType, calcValue: l.calcValue == null ? null : Number(l.calcValue), minutes: l.minutes, amount: Number(l.amount), refId: l.refId, source: l.source, required: l.required, note: l.note, orderIndex: l.orderIndex })) : null,
    };
    return base;
  });

  return ok({
    serviceId: service.id, serviceCode: service.code, serviceName: service.name, category: service.category?.name ?? null,
    standardPrice: Number(service.standardPrice), durationMinutes: service.durationMinutes, canSeeFinance: fin, versions,
  });
});

// Tạo version DRAFT mới (bỏ trống lines → tự dựng từ định mức + nhân sự dịch vụ).
export const POST = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.PRICEFLOOR_WRITE);
  const body = floorVersionCreateSchema.parse({ ...(await req.json()), serviceId: params.serviceId });
  const version = await createFloorVersion({ ...body, createdBy: session.name });
  await auditLog({ userId: session.userId, action: "PRICE_FLOOR_VERSION_CREATE", entityType: "ServicePriceFloorVersion", entityId: version.id, changes: { serviceId: params.serviceId, version: version.version, floorPrice: Number(version.floorPrice) } });
  return created(version);
});
