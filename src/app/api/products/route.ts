export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { productCreateSchema } from "@/lib/validation";
import { ensureUnique } from "@/lib/unique";

export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.PRODUCT_READ);
  const url = new URL(req.url);
  const categoryId = url.searchParams.get("categoryId");
  const rows = await prisma.product.findMany({
    where: { ...(categoryId ? { categoryId } : {}) },
    include: { category: true },
    orderBy: { name: "asc" },
  });
  return ok(rows);
});

export const POST = handle(async (req) => {
  await requirePermission(PERMISSIONS.PRODUCT_WRITE);
  const data = productCreateSchema.parse(await req.json());
  await ensureUnique("product", "sku", data.sku, "Mã SKU");
  await ensureUnique("product", "barcode", data.barcode, "Mã vạch");
  const row = await prisma.product.create({ data });
  return created(row);
});
