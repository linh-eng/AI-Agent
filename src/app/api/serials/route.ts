export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import type { Prisma } from "@prisma/client";

export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.PRODUCT_READ);
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  const warehouseId = url.searchParams.get("warehouseId") || undefined;
  const status = url.searchParams.get("status") || undefined;
  const projectId = url.searchParams.get("projectId") || undefined;

  const where: Prisma.SerialWhereInput = {
    ...(warehouseId ? { warehouseId } : {}),
    ...(status ? { status: status as any } : {}),
    ...(projectId ? { projectId } : {}),
    ...(q
      ? {
          OR: [
            { serialNumber: { contains: q, mode: "insensitive" } },
            { product: { sku: { contains: q, mode: "insensitive" } } },
            { product: { name: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const serials = await prisma.serial.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      product: { select: { sku: true, name: true, trackingMode: true } },
      warehouse: { select: { code: true, name: true, countsAsAvailable: true } },
      supplier: { select: { code: true, name: true } },
      project: { select: { code: true, name: true } },
    },
  });
  return ok(serials);
});
