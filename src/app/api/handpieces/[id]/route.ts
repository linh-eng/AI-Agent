export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { handpieceUpdateSchema } from "@/lib/validation";

export const GET = handle(async (_req, ctx) => {
  await requirePermission(PERMISSIONS.ASSET_READ);
  const row = await prisma.handpiece.findUniqueOrThrow({
    where: { id: ctx.params.id },
    include: {
      asset: { select: { code: true, product: { select: { name: true } } } },
      shotLogs: {
        include: { createdBy: { select: { name: true } } },
        orderBy: { performedAt: "desc" },
      },
    },
  });
  return ok(row);
});

export const PATCH = handle(async (req, ctx) => {
  await requirePermission(PERMISSIONS.ASSET_WRITE);
  const input = handpieceUpdateSchema.parse(await req.json());
  const row = await prisma.handpiece.update({
    where: { id: ctx.params.id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.assetId !== undefined ? { assetId: input.assetId } : {}),
      ...(input.machine !== undefined ? { machine: input.machine } : {}),
      ...(input.maxShots !== undefined ? { maxShots: input.maxShots } : {}),
      ...(input.warnShots !== undefined ? { warnShots: input.warnShots } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.note !== undefined ? { note: input.note } : {}),
    },
  });
  return ok(row);
});
