export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";

export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.PRODUCT_READ);
  const url = new URL(req.url);
  const warehouseId = url.searchParams.get("warehouseId") || undefined;
  const lots = await prisma.lot.findMany({
    where: warehouseId ? { warehouseId } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      product: { select: { sku: true, name: true } },
      warehouse: { select: { code: true, name: true } },
      supplier: { select: { code: true, name: true } },
    },
  });
  return ok(lots);
});
