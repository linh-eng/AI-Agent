export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";

export const GET = handle(async (_req, ctx) => {
  await requirePermission(PERMISSIONS.INVENTORY_READ);
  const row = await prisma.stockTransfer.findUniqueOrThrow({
    where: { id: ctx.params.id },
    include: {
      fromWarehouse: true,
      toWarehouse: true,
      createdBy: { select: { name: true } },
      items: { include: { product: true } },
    },
  });
  // Chi tiết lô đã chuyển (từ sổ cái)
  const movements = await prisma.stockMovement.findMany({
    where: { refType: "TRANSFER", refId: row.id, type: "OUTBOUND" },
    include: { product: true, batch: true },
  });
  return ok({ ...row, movements });
});
