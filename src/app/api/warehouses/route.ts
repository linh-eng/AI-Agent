export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { warehouseCreateSchema } from "@/lib/validation";

export const GET = handle(async () => {
  await requirePermission(PERMISSIONS.WAREHOUSE_READ);
  const rows = await prisma.warehouse.findMany({ orderBy: { code: "asc" } });
  return ok(rows);
});

export const POST = handle(async (req) => {
  await requirePermission(PERMISSIONS.WAREHOUSE_WRITE);
  const data = warehouseCreateSchema.parse(await req.json());
  const row = await prisma.warehouse.create({ data });
  return created(row);
});
