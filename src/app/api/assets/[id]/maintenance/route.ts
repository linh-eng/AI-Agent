export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { maintenanceCreateSchema } from "@/lib/validation";

export const GET = handle(async (_req, ctx) => {
  await requirePermission(PERMISSIONS.ASSET_READ);
  const rows = await prisma.maintenanceLog.findMany({
    where: { assetId: ctx.params.id },
    include: { createdBy: { select: { name: true } } },
    orderBy: { performedAt: "desc" },
  });
  return ok(rows);
});

export const POST = handle(async (req, ctx) => {
  const session = await requirePermission(PERMISSIONS.ASSET_WRITE);
  const input = maintenanceCreateSchema.parse(await req.json());
  const row = await prisma.maintenanceLog.create({
    data: {
      assetId: ctx.params.id,
      type: input.type,
      description: input.description,
      cost: input.cost ?? null,
      vendor: input.vendor,
      performedBy: input.performedBy,
      performedAt: new Date(input.performedAt),
      note: input.note,
      createdById: session.userId,
    },
  });
  return created(row);
});
