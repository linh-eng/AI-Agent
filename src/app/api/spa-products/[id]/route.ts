export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { spaProductUpdateSchema } from "@/lib/library-validation";

export const PATCH = handle(async (req, { params }) => {
  await requirePermission(PERMISSIONS.CATALOG_WRITE);
  const parsed = spaProductUpdateSchema.parse(await req.json());
  const product = await prisma.spaProduct.update({ where: { id: params.id }, data: parsed });
  return ok(product);
});

export const DELETE = handle(async (_req, { params }) => {
  await requirePermission(PERMISSIONS.CATALOG_WRITE);
  const product = await prisma.spaProduct.update({ where: { id: params.id }, data: { isActive: false } });
  return ok({ id: product.id, isActive: product.isActive });
});
