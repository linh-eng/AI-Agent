export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { stockCountCreateSchema } from "@/lib/validation";
import { createStockCount } from "@/lib/stockcount-service";

export const GET = handle(async () => {
  await requirePermission(PERMISSIONS.INVENTORY_READ);
  const rows = await prisma.stockCount.findMany({
    include: {
      warehouse: true,
      createdBy: { select: { name: true } },
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return ok(rows);
});

export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.STOCKCOUNT_WRITE);
  const { warehouseId, note } = stockCountCreateSchema.parse(await req.json());
  const result = await createStockCount(warehouseId, note, session.userId);
  return created(result);
});
