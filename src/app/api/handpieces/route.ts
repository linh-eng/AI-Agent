export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { handpieceCreateSchema } from "@/lib/validation";
import { nextHandpieceCode } from "@/lib/codes";

export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.ASSET_READ);
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const rows = await prisma.handpiece.findMany({
    where: { ...(status ? { status: status as any } : {}) },
    include: { asset: { select: { code: true, product: { select: { name: true } } } } },
    orderBy: { code: "asc" },
  });
  return ok(rows);
});

export const POST = handle(async (req) => {
  await requirePermission(PERMISSIONS.ASSET_WRITE);
  const input = handpieceCreateSchema.parse(await req.json());
  const code = input.code ?? (await nextHandpieceCode());
  const row = await prisma.handpiece.create({
    data: {
      code,
      name: input.name,
      assetId: input.assetId,
      machine: input.machine,
      maxShots: input.maxShots,
      usedShots: input.usedShots,
      warnShots: input.warnShots,
      note: input.note,
    },
  });
  return created(row);
});
