export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { inboundCreateSchema } from "@/lib/validation";
import { createInbound } from "@/lib/inbound-service";

export const GET = handle(async () => {
  await requirePermission(PERMISSIONS.PRODUCT_READ);
  const orders = await prisma.inboundOrder.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      supplier: { select: { code: true, name: true } },
      _count: { select: { lines: true } },
    },
  });
  return ok(orders);
});

export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.INBOUND_WRITE);
  const input = inboundCreateSchema.parse(await req.json());
  const order = await createInbound(input, session.userId);
  return created(order);
});
