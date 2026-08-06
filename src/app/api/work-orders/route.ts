export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { workOrderCreateSchema } from "@/lib/validation";
import { createWorkOrder } from "@/lib/workorder-service";

export const GET = handle(async () => {
  await requirePermission(PERMISSIONS.PRODUCT_READ);
  const orders = await prisma.workOrder.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      product: { select: { sku: true, name: true } },
      _count: { select: { bomPlanned: true, bomAsBuilt: true } },
    },
  });
  return ok(orders);
});

export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.WORKORDER_WRITE);
  const input = workOrderCreateSchema.parse(await req.json());
  const wo = await createWorkOrder(input, session.userId);
  return created(wo);
});
