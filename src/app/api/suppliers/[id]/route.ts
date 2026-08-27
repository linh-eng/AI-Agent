export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { supplierCreateSchema } from "@/lib/validation";

export const PATCH = handle(async (req, ctx) => {
  await requirePermission(PERMISSIONS.SUPPLIER_WRITE);
  const data = supplierCreateSchema.partial().parse(await req.json());
  const row = await prisma.supplier.update({ where: { id: ctx.params.id }, data });
  return ok(row);
});
