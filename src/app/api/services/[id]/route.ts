export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePermission, getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { serviceUpdateSchema } from "@/lib/clinic-validation";
import { auditLog, canSeeFinance, maskFinance } from "@/lib/clinic";
import { splitServiceInput, materialCreateRows, enrichServiceDetail } from "@/lib/service";
import { serviceStepsInclude, buildStepsCreate, sopTotalDuration, expectedMaterialCost } from "@/lib/service-sop";

export const GET = handle(async (_req, { params }) => {
  await requirePermission(PERMISSIONS.SERVICE_READ);
  const session = await getSession();
  const canSee = canSeeFinance(session);
  const service = await prisma.service.findUnique({
    where: { id: params.id },
    include: {
      category: { select: { id: true, name: true } },
      materialStandards: { orderBy: { orderIndex: "asc" } },
      ...serviceStepsInclude, // SOP chuẩn hóa (Redesign P1)
    },
  });
  if (!service) return fail(404, "Không tìm thấy dịch vụ");
  const { technologies, protocols, floorSummary } = await enrichServiceDetail(service);
  // Chi phí vật tư định mức từ SOP (nhạy cảm — chỉ tính khi có finance.read).
  const sopDuration = sopTotalDuration((service as any).steps);
  let sopMaterialCost: number | null = null;
  if (canSee) {
    const pids = ((service as any).steps ?? []).flatMap((s: any) => (s.products ?? []).map((p: any) => p.spaProductId).filter(Boolean));
    if (pids.length) {
      const prods = await prisma.spaProduct.findMany({ where: { id: { in: pids } }, select: { id: true, cost: true } });
      sopMaterialCost = expectedMaterialCost((service as any).steps, new Map(prods.map((p) => [p.id, Number(p.cost ?? 0)])));
    } else sopMaterialCost = 0;
  }
  const masked = maskFinance({ ...service, floorSummary }, canSee, ["expectedCost"]);
  if (!canSee) (masked as any).floorSummary = { ...floorSummary, totalCost: null, floorPrice: null };
  return ok({ ...masked, technologies, protocols, sopDuration, sopMaterialCost });
});

export const PATCH = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.SERVICE_WRITE);
  const parsed = serviceUpdateSchema.parse(await req.json());
  const before = await prisma.service.findUnique({
    where: { id: params.id },
    select: { standardPrice: true, expectedCost: true, version: true, _count: { select: { steps: true } } },
  });
  if (!before) return fail(404, "Không tìm thấy dịch vụ");
  const { data, materials } = splitServiceInput(parsed);
  const { steps } = parsed as any;
  // Sửa SOP (steps) → TĂNG version (bất biến: buổi cũ đã snapshot không đổi — mục 9/P4).
  if (steps !== undefined) (data as any).version = { increment: 1 };

  const service = await prisma.$transaction(async (tx) => {
    if (materials !== undefined) {
      await tx.serviceMaterialStandard.deleteMany({ where: { serviceId: params.id } });
    }
    // Thay toàn bộ SOP nếu payload gửi `steps` (cascade xóa product/technology/option cũ).
    if (steps !== undefined) {
      await tx.serviceStep.deleteMany({ where: { serviceId: params.id } });
    }
    return tx.service.update({
      where: { id: params.id },
      data: {
        ...data,
        materialStandards: materials !== undefined ? { create: materialCreateRows(materials) } : undefined,
        steps: steps !== undefined ? { create: buildStepsCreate(steps) } : undefined,
      } as any,
    });
  });

  if (parsed.standardPrice !== undefined || parsed.expectedCost !== undefined) {
    await auditLog({
      userId: session.userId,
      action: "PRICE_CHANGE",
      entityType: "Service",
      entityId: service.id,
      changes: { before: { standardPrice: before.standardPrice, expectedCost: before.expectedCost }, after: { standardPrice: service.standardPrice, expectedCost: service.expectedCost } },
    });
  }
  // Audit thay đổi SOP (before/after version + số bước) — thay đổi chuyên môn quan trọng (mục 24).
  if (steps !== undefined) {
    await auditLog({
      userId: session.userId,
      action: "SERVICE_SOP_CHANGED",
      entityType: "Service",
      entityId: service.id,
      changes: { version: { before: before.version, after: service.version }, stepCount: { before: before._count.steps, after: steps.length } },
    });
  }
  return ok(service);
});
