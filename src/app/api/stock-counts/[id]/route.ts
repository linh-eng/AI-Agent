export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";

export const GET = handle(async (_req, { params }: { params: { id: string } }) => {
  await requirePermission(PERMISSIONS.PRODUCT_READ);
  const count = await prisma.stockCount.findUniqueOrThrow({
    where: { id: params.id },
    include: { lines: { orderBy: { serialNumber: "asc" } } },
  });
  const warehouse = count.warehouseId
    ? await prisma.warehouse.findUnique({ where: { id: count.warehouseId }, select: { code: true, name: true } })
    : null;
  return ok({ ...count, warehouse });
});
