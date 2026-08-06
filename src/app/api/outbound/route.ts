export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { outboundCreateSchema } from "@/lib/validation";
import { createOutbound } from "@/lib/outbound-service";

export const GET = handle(async () => {
  await requirePermission(PERMISSIONS.PRODUCT_READ);
  const orders = await prisma.outboundOrder.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      customer: { select: { code: true, name: true } },
      project: { select: { code: true } },
      _count: { select: { lines: true } },
    },
  });
  return ok(orders);
});

export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.OUTBOUND_WRITE);
  const input = outboundCreateSchema.parse(await req.json());
  const order = await createOutbound(input, session.userId);
  return created(order);
});
