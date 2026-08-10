export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";

export const GET = handle(async (_req, ctx) => {
  await requirePermission(PERMISSIONS.INVENTORY_READ);
  const row = await prisma.goodsReceipt.findUniqueOrThrow({
    where: { id: ctx.params.id },
    include: {
      supplier: true,
      warehouse: true,
      createdBy: { select: { name: true } },
      items: { include: { product: true } },
    },
  });
  return ok(row);
});
