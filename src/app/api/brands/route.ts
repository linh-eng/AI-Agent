export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { brandCreateSchema } from "@/lib/validation";

export const GET = handle(async () => {
  await requirePermission(PERMISSIONS.PRODUCT_READ);
  const rows = await prisma.brand.findMany({ orderBy: { name: "asc" } });
  return ok(rows);
});

export const POST = handle(async (req) => {
  await requirePermission(PERMISSIONS.PRODUCT_WRITE);
  const data = brandCreateSchema.parse(await req.json());
  const row = await prisma.brand.create({ data });
  return created(row);
});
