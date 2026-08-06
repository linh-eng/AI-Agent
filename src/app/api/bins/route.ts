export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { binCreateSchema } from "@/lib/validation";

export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.BIN_READ);
  const url = new URL(req.url);
  const zoneId = url.searchParams.get("zoneId") ?? undefined;
  const bins = await prisma.bin.findMany({
    where: zoneId ? { zoneId } : undefined,
    orderBy: { code: "asc" },
  });
  return ok(bins);
});

export const POST = handle(async (req) => {
  await requirePermission(PERMISSIONS.BIN_WRITE);
  const data = binCreateSchema.parse(await req.json());
  const bin = await prisma.bin.create({ data });
  return created(bin);
});