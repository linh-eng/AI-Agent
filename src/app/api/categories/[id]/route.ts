export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { categoryUpdateSchema } from "@/lib/validation";

export const PATCH = handle(async (req, ctx) => {
  await requirePermission(PERMISSIONS.CATEGORY_WRITE);
  const data = categoryUpdateSchema.parse(await req.json());
  const row = await prisma.category.update({ where: { id: ctx.params.id }, data });
  return ok(row);
});
