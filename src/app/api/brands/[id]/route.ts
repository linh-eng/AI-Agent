export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { brandCreateSchema } from "@/lib/validation";

export const PATCH = handle(async (req, ctx) => {
  await requirePermission(PERMISSIONS.PRODUCT_WRITE);
  const data = brandCreateSchema.partial().parse(await req.json());
  const row = await prisma.brand.update({ where: { id: ctx.params.id }, data });
  return ok(row);
});
