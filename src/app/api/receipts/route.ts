export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { receiptCreateSchema } from "@/lib/validation";
import { createReceipt } from "@/lib/inbound-service";

export const GET = handle(async () => {
  await requirePermission(PERMISSIONS.INVENTORY_READ);
  const rows = await prisma.goodsReceipt.findMany({
    include: {
      supplier: true,
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
  const session = await requirePermission(PERMISSIONS.INBOUND_WRITE);
  const input = receiptCreateSchema.parse(await req.json());
  const result = await createReceipt(input, session.userId);
  return created(result);
});
