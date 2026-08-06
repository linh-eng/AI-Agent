export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { productCreateSchema } from "@/lib/validation";

export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.PRODUCT_READ);
  const url = new URL(req.url);
  const mode = url.searchParams.get("trackingMode");
  const products = await prisma.product.findMany({
    where: mode ? { trackingMode: mode as any } : undefined,
    orderBy: { sku: "asc" },
  });
  return ok(products);
});

export const POST = handle(async (req) => {
  await requirePermission(PERMISSIONS.PRODUCT_WRITE);
  const parsed = productCreateSchema.parse(await req.json());
  const data = { ...parsed, barcode: parsed.barcode ? parsed.barcode : null };
  const product = await prisma.product.create({ data });
  return created(product);
});