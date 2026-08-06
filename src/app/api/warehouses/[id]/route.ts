export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { warehouseUpdateSchema } from "@/lib/validation";

export const GET = handle(async (_req, { params }: { params: { id: string } }) => {
  await requirePermission(PERMISSIONS.WAREHOUSE_READ);
  const warehouse = await prisma.warehouse.findUniqueOrThrow({
    where: { id: params.id },
    include: { zones: { include: { bins: true } } },
  });
  return ok(warehouse);
});

export const PATCH = handle(async (req, { params }: { params: { id: string } }) => {
  await requirePermission(PERMISSIONS.WAREHOUSE_WRITE);
  const data = warehouseUpdateSchema.parse(await req.json());
  const warehouse = await prisma.warehouse.update({ where: { id: params.id }, data });
  return ok(warehouse);
});