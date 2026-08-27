export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { transferCreateSchema } from "@/lib/validation";
import { createTransfer } from "@/lib/transfer-service";

export const GET = handle(async () => {
  await requirePermission(PERMISSIONS.INVENTORY_READ);
  const rows = await prisma.stockTransfer.findMany({
    include: {
      fromWarehouse: true,
      toWarehouse: true,
      createdBy: { select: { name: true } },
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return ok(rows);
});

export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.TRANSFER_WRITE);
  const input = transferCreateSchema.parse(await req.json());
  const result = await createTransfer(input, session.userId);
  return created(result);
});
