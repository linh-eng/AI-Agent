export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { productCreateSchema } from "@/lib/validation";
import { ensureUnique } from "@/lib/unique";

export const GET = handle(async (_req, ctx) => {
  await requirePermission(PERMISSIONS.PRODUCT_READ);
  const row = await prisma.product.findUniqueOrThrow({
    where: { id: ctx.params.id },
    include: { category: true, batches: { orderBy: { expiryDate: "asc" } } },
  });
  return ok(row);
});

export const PATCH = handle(async (req, ctx) => {
  await requirePermission(PERMISSIONS.PRODUCT_MANAGE);
  const data = productCreateSchema.partial().parse(await req.json());
  await ensureUnique("product", "sku", data.sku, "Mã SKU", ctx.params.id);
  await ensureUnique("product", "barcode", data.barcode, "Mã vạch", ctx.params.id);
  const row = await prisma.product.update({ where: { id: ctx.params.id }, data });
  return ok(row);
});
