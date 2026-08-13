export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle, fail } from "@/lib/api";
import { requirePermission, requireAuth } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { priceFloorUpsertSchema } from "@/lib/clinic-validation";
import { canSeeFinance, auditLog } from "@/lib/clinic";
import { computeFloor } from "@/lib/price-floor";

// Danh sách giá sàn theo dịch vụ — chi phí nhạy cảm, chỉ finance.read xem.
export const GET = handle(async () => {
  const session = await requireAuth();
  if (!canSeeFinance(session)) return fail(403, "Không có quyền xem chi phí/giá sàn");
  const services = await prisma.service.findMany({
    where: { isActive: true },
    include: { priceFloor: true, category: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
  const rows = services.map((s) => {
    const f = s.priceFloor;
    const comp = {
      laborCost: Number(f?.laborCost ?? 0),
      operationCost: Number(f?.operationCost ?? 0),
      depreciationCost: Number(f?.depreciationCost ?? 0),
      materialCost: Number(f?.materialCost ?? 0),
      roomCost: Number(f?.roomCost ?? 0),
      otherCost: Number(f?.otherCost ?? 0),
      minMarginPercent: Number(f?.minMarginPercent ?? 0),
    };
    const { totalCost, floorPrice } = computeFloor(comp);
    return {
      serviceId: s.id,
      serviceCode: s.code,
      serviceName: s.name,
      category: s.category?.name ?? null,
      standardPrice: Number(s.standardPrice),
      hasFloor: !!f,
      ...comp,
      note: f?.note ?? null,
      totalCost,
      floorPrice,
      belowFloor: !!f && Number(s.standardPrice) + 1e-6 < floorPrice, // giá chuẩn có dưới sàn không
    };
  });
  return ok(rows);
});

// Khai báo/cập nhật cấu trúc chi phí (upsert theo serviceId).
export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.PRICEFLOOR_WRITE);
  const parsed = priceFloorUpsertSchema.parse(await req.json());
  const service = await prisma.service.findUnique({ where: { id: parsed.serviceId }, select: { id: true } });
  if (!service) return fail(404, "Không tìm thấy dịch vụ");

  const data = {
    laborCost: parsed.laborCost,
    operationCost: parsed.operationCost,
    depreciationCost: parsed.depreciationCost,
    materialCost: parsed.materialCost,
    roomCost: parsed.roomCost,
    otherCost: parsed.otherCost,
    minMarginPercent: parsed.minMarginPercent,
    note: parsed.note ?? null,
    updatedBy: session.name,
  };
  const floor = await prisma.servicePriceFloor.upsert({
    where: { serviceId: parsed.serviceId },
    create: { serviceId: parsed.serviceId, ...data },
    update: data,
  });
  const { totalCost, floorPrice } = computeFloor(parsed);
  await auditLog({
    userId: session.userId,
    action: "PRICE_FLOOR_SET",
    entityType: "ServicePriceFloor",
    entityId: floor.id,
    changes: { serviceId: parsed.serviceId, totalCost, floorPrice },
  });
  return created({ ...floor, totalCost, floorPrice });
});
