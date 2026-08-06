export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { zoneCreateSchema } from "@/lib/validation";

export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.BIN_READ);
  const url = new URL(req.url);
  const warehouseId = url.searchParams.get("warehouseId") ?? undefined;
  const zones = await prisma.zone.findMany({
    where: warehouseId ? { warehouseId } : undefined,
    orderBy: { code: "asc" },
    include: { bins: true, warehouse: { select: { code: true, name: true } } },
  });
  return ok(zones);
});

export const POST = handle(async (req) => {
  await requirePermission(PERMISSIONS.BIN_WRITE);
  const data = zoneCreateSchema.parse(await req.json());
  const zone = await prisma.zone.create({ data });
  return created(zone);
});