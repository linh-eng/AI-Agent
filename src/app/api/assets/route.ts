export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { assetCreateSchema } from "@/lib/validation";
import { nextAssetCode } from "@/lib/codes";

function parseDate(v?: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.ASSET_READ);
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const rows = await prisma.asset.findMany({
    where: { ...(status ? { status: status as any } : {}) },
    include: {
      product: { select: { sku: true, name: true } },
      warehouse: { select: { name: true } },
      supplier: { select: { name: true } },
    },
    orderBy: { code: "asc" },
  });
  return ok(rows);
});

export const POST = handle(async (req) => {
  await requirePermission(PERMISSIONS.ASSET_WRITE);
  const input = assetCreateSchema.parse(await req.json());
  const code = input.code ?? (await nextAssetCode());
  const row = await prisma.asset.create({
    data: {
      code,
      productId: input.productId,
      serialNumber: input.serialNumber,
      warehouseId: input.warehouseId,
      status: input.status,
      location: input.location,
      purchaseDate: parseDate(input.purchaseDate),
      warrantyUntil: parseDate(input.warrantyUntil),
      supplierId: input.supplierId,
      note: input.note,
      cost: input.cost ?? null,
      salvageValue: input.salvageValue ?? null,
      depreciationStart: parseDate(input.depreciationStart),
      depreciationMonths: input.depreciationMonths ?? null,
      depreciationMethod: input.depreciationMethod ?? null,
      depreciationTotalUnits: input.depreciationTotalUnits ?? null,
      warrantyVendor: input.warrantyVendor,
      warrantyMonths: input.warrantyMonths ?? null,
      maintenanceCycleMonths: input.maintenanceCycleMonths ?? null,
      contractValue: input.contractValue ?? null,
      managementType: input.managementType ?? null,
    },
    include: { product: { select: { sku: true, name: true } } },
  });
  return created(row);
});
