export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission, getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { spaProductCreateSchema } from "@/lib/library-validation";
import { sequentialCode, canSeeFinance, maskFinance } from "@/lib/clinic";

export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.LIBRARY_READ);
  const session = await getSession();
  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? undefined; // PROFESSIONAL | HOME_CARE | BOTH
  const products = await prisma.spaProduct.findMany({
    where: {
      isActive: true,
      ...(type ? { OR: [{ productType: type as any }, { productType: "BOTH" }] } : {}),
    },
    include: { brand: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
  const canSee = canSeeFinance(session);
  return ok(products.map((p) => maskFinance(p, canSee, ["cost"])));
});

export const POST = handle(async (req) => {
  await requirePermission(PERMISSIONS.CATALOG_WRITE);
  const parsed = spaProductCreateSchema.parse(await req.json());
  const sku = parsed.sku ?? sequentialCode("SP", await prisma.spaProduct.count());
  const product = await prisma.spaProduct.create({ data: { ...parsed, sku } });
  return created(product);
});
