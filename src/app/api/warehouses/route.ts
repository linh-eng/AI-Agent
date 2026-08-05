export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { warehouseCreateSchema } from "@/lib/validation";

export const GET = handle(async () => {
  await requirePermission(PERMISSIONS.WAREHOUSE_READ);
  const warehouses = await prisma.warehouse.findMany({
    orderBy: { code: "asc" },
    include: { _count: { select: { serials: true, zones: true } } },
  });
  return ok(warehouses);
});

export const POST = handle(async (req) => {
  await requirePermission(PERMISSIONS.WAREHOUSE_WRITE);
  const data = warehouseCreateSchema.parse(await req.json());
  const warehouse = await prisma.warehouse.create({ data });
  return created(warehouse);
});