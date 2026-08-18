export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { assetUpdateSchema } from "@/lib/validation";

function parseDate(v?: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

export const GET = handle(async (_req, ctx) => {
  await requirePermission(PERMISSIONS.ASSET_READ);
  const row = await prisma.asset.findUniqueOrThrow({
    where: { id: ctx.params.id },
    include: {
      product: { select: { sku: true, name: true } },
      warehouse: { select: { name: true } },
      supplier: { select: { name: true } },
      maintenance: {
        include: { createdBy: { select: { name: true } } },
        orderBy: { performedAt: "desc" },
      },
      payments: {
        include: {
          createdBy: { select: { name: true } },
          attachments: {
            select: { id: true, kind: true, filename: true, mimeType: true, size: true, note: true, createdAt: true },
          },
        },
        orderBy: { paidDate: "asc" },
      },
      // File cấp tài sản (hợp đồng, hóa đơn) — không kèm nội dung file (data) cho nhẹ.
      attachments: {
        where: { paymentId: null },
        select: { id: true, kind: true, filename: true, mimeType: true, size: true, note: true, createdAt: true, uploadedBy: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  return ok(row);
});

export const PATCH = handle(async (req, ctx) => {
  await requirePermission(PERMISSIONS.ASSET_MANAGE);
  const input = assetUpdateSchema.parse(await req.json());
  const row = await prisma.asset.update({
    where: { id: ctx.params.id },
    data: {
      ...(input.serialNumber !== undefined ? { serialNumber: input.serialNumber } : {}),
      ...(input.warehouseId !== undefined ? { warehouseId: input.warehouseId } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.location !== undefined ? { location: input.location } : {}),
      ...(input.purchaseDate !== undefined ? { purchaseDate: parseDate(input.purchaseDate) } : {}),
      ...(input.warrantyUntil !== undefined ? { warrantyUntil: parseDate(input.warrantyUntil) } : {}),
      ...(input.supplierId !== undefined ? { supplierId: input.supplierId } : {}),
      ...(input.note !== undefined ? { note: input.note } : {}),
      ...(input.cost !== undefined ? { cost: input.cost } : {}),
      ...(input.salvageValue !== undefined ? { salvageValue: input.salvageValue } : {}),
      ...(input.depreciationStart !== undefined ? { depreciationStart: parseDate(input.depreciationStart) } : {}),
      ...(input.depreciationMonths !== undefined ? { depreciationMonths: input.depreciationMonths } : {}),
      ...(input.depreciationMethod !== undefined ? { depreciationMethod: input.depreciationMethod } : {}),
      ...(input.warrantyVendor !== undefined ? { warrantyVendor: input.warrantyVendor } : {}),
      ...(input.warrantyMonths !== undefined ? { warrantyMonths: input.warrantyMonths } : {}),
      ...(input.maintenanceCycleMonths !== undefined ? { maintenanceCycleMonths: input.maintenanceCycleMonths } : {}),
      ...(input.contractValue !== undefined ? { contractValue: input.contractValue } : {}),
      ...(input.managementType !== undefined ? { managementType: input.managementType } : {}),
    },
  });
  return ok(row);
});
