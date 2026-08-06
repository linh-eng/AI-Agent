export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { disassemblyCreateSchema } from "@/lib/validation";
import { createDisassembly } from "@/lib/disassembly-service";

export const GET = handle(async () => {
  await requirePermission(PERMISSIONS.PRODUCT_READ);
  const orders = await prisma.disassemblyOrder.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  const pids = orders.map((o) => o.parentSerialId);
  const serials = await prisma.serial.findMany({
    where: { id: { in: pids } },
    select: { id: true, serialNumber: true, product: { select: { name: true } } },
  });
  const map = new Map(serials.map((s) => [s.id, s]));
  return ok(orders.map((o) => ({ ...o, parentSerial: map.get(o.parentSerialId) })));
});

export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.WARRANTY_WRITE);
  const input = disassemblyCreateSchema.parse(await req.json());
  const order = await createDisassembly(input, session.userId);
  return created(order);
});
