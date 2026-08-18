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
    },
  });
  return ok(row);
});
