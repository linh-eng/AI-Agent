export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { productUpdateSchema } from "@/lib/validation";

export const GET = handle(async (_req, { params }: { params: { id: string } }) => {
  await requirePermission(PERMISSIONS.PRODUCT_READ);
  const product = await prisma.product.findUniqueOrThrow({ where: { id: params.id } });
  return ok(product);
});

export const PATCH = handle(async (req, { params }: { params: { id: string } }) => {
  await requirePermission(PERMISSIONS.PRODUCT_WRITE);
  const parsed = productUpdateSchema.parse(await req.json());
  const data = "barcode" in parsed ? { ...parsed, barcode: parsed.barcode ? parsed.barcode : null } : parsed;
  const product = await prisma.product.update({ where: { id: params.id }, data });
  return ok(product);
});