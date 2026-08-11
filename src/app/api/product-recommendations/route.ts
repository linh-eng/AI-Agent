export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { recommendationCreateSchema } from "@/lib/library-validation";

export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.LIBRARY_READ);
  const url = new URL(req.url);
  const customerId = url.searchParams.get("customerId") ?? undefined;
  const planId = url.searchParams.get("planId") ?? undefined;
  const items = await prisma.productRecommendation.findMany({
    where: { ...(customerId ? { customerId } : {}), ...(planId ? { planId } : {}) },
    include: { product: { include: { brand: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
  });
  return ok(items);
});

export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.RECOMMEND_WRITE);
  const parsed = recommendationCreateSchema.parse(await req.json());
  // Nếu không nhập giá, lấy giá bán của sản phẩm tại thời điểm đề xuất.
  let price = parsed.price ?? undefined;
  if (price === undefined) {
    const prod = await prisma.spaProduct.findUnique({
      where: { id: parsed.spaProductId },
      select: { sellingPrice: true },
    });
    if (prod?.sellingPrice != null) price = Number(prod.sellingPrice);
  }
  const rec = await prisma.productRecommendation.create({
    data: { ...parsed, price: price ?? null, createdBy: parsed.createdBy ?? session.name },
    include: { product: { select: { name: true } } },
  });
  return created(rec);
});
