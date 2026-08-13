export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePermission, getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { serviceUpdateSchema } from "@/lib/clinic-validation";
import { auditLog, canSeeFinance, maskFinance } from "@/lib/clinic";
import { splitServiceInput, materialCreateRows, enrichServiceDetail } from "@/lib/service";

export const GET = handle(async (_req, { params }) => {
  await requirePermission(PERMISSIONS.SERVICE_READ);
  const session = await getSession();
  const canSee = canSeeFinance(session);
  const service = await prisma.service.findUnique({
    where: { id: params.id },
    include: {
      category: { select: { id: true, name: true } },
      materialStandards: { orderBy: { orderIndex: "asc" } },
    },
  });
  if (!service) return fail(404, "Không tìm thấy dịch vụ");
  const { technologies, protocols, floorSummary } = await enrichServiceDetail(service);
  const masked = maskFinance({ ...service, floorSummary }, canSee, ["expectedCost"]);
  if (!canSee) (masked as any).floorSummary = { ...floorSummary, totalCost: null, floorPrice: null };
  return ok({ ...masked, technologies, protocols });
});

export const PATCH = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.SERVICE_WRITE);
  const parsed = serviceUpdateSchema.parse(await req.json());
  const before = await prisma.service.findUnique({ where: { id: params.id }, select: { standardPrice: true, expectedCost: true } });
  if (!before) return fail(404, "Không tìm thấy dịch vụ");
  const { data, materials } = splitServiceInput(parsed);

  const service = await prisma.$transaction(async (tx) => {
    // Thay toàn bộ vật tư định mức nếu payload có gửi `materials` (không đổi lịch sử buổi).
    if (materials !== undefined) {
      await tx.serviceMaterialStandard.deleteMany({ where: { serviceId: params.id } });
    }
    return tx.service.update({
      where: { id: params.id },
      data: {
        ...data,
        materialStandards: materials !== undefined ? { create: materialCreateRows(materials) } : undefined,
      } as any,
    });
  });

  // Ghi audit khi đổi giá (lưu lịch sử; KHÔNG đổi Booking/Session lịch sử — mục 20).
  if (parsed.standardPrice !== undefined || parsed.expectedCost !== undefined) {
    await auditLog({
      userId: session.userId,
      action: "PRICE_CHANGE",
      entityType: "Service",
      entityId: service.id,
      changes: { before: { standardPrice: before.standardPrice, expectedCost: before.expectedCost }, after: { standardPrice: service.standardPrice, expectedCost: service.expectedCost } },
    });
  }
  return ok(service);
});
