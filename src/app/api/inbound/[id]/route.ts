export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";

export const GET = handle(async (_req, { params }: { params: { id: string } }) => {
  await requirePermission(PERMISSIONS.PRODUCT_READ);
  const order = await prisma.inboundOrder.findUniqueOrThrow({
    where: { id: params.id },
    include: {
      supplier: true,
      lines: {
        include: {
          product: { select: { id: true, sku: true, name: true, trackingMode: true } },
          project: { select: { id: true, code: true, name: true } },
        },
      },
    },
  });
  return ok(order);
});
