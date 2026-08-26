export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";

// Danh sách Kho Dịch Vụ (hàng đã mở nắp dùng dở) + định mức tiêu hao theo dịch vụ.
export const GET = handle(async () => {
  await requirePermission(PERMISSIONS.SERVICE_READ);

  const raw = await prisma.serviceStockItem.findMany({
    include: {
      product: {
        select: {
          id: true, sku: true, name: true, uom: true, expiryDate: true, openedDate: true,
          category: { select: { name: true, openMaxMonths: true } },
        },
      },
      service: { select: { id: true, code: true, name: true } },
      openedBy: { select: { name: true } },
      updatedBy: { select: { name: true } },
    },
    orderBy: [{ openedDate: "asc" }],
  });

  // Gộp 1 dòng cho mỗi sản phẩm (giữ dòng mở sớm nhất) — tránh nhân bản do dữ liệu cũ.
  const byProduct = new Map<string, (typeof raw)[number]>();
  for (const it of raw) if (!byProduct.has(it.productId)) byProduct.set(it.productId, it);
  const uniq = Array.from(byProduct.values());
  const productIds = uniq.map((i) => i.productId);

  // TỒN THỰC TẾ của sản phẩm (còn lại) — tính động từ StockBatch.
  const sums = productIds.length
    ? await prisma.stockBatch.groupBy({ by: ["productId"], where: { productId: { in: productIds } }, _sum: { quantity: true } })
    : [];
  const onHandByProduct = new Map(sums.map((s) => [s.productId, s._sum.quantity ?? 0]));

  // HSD sau mở = HSD đã lưu ở sổ, hoặc HSD của SẢN PHẨM, hoặc ngày mở + PAO nhóm.
  const items = uniq.map((it) => {
    let expiryDate = it.expiryDate ?? it.product.expiryDate ?? null;
    const pao = it.product.category?.openMaxMonths ?? null;
    if (!expiryDate && pao) {
      const d = new Date(it.openedDate);
      d.setMonth(d.getMonth() + pao);
      expiryDate = d;
    }
    const onHand = onHandByProduct.get(it.productId) ?? 0;
    return { ...it, expiryDate, remainingQty: onHand, status: onHand <= 0 ? "EMPTY" : "IN_USE" };
  });
  const norms = productIds.length
    ? await prisma.serviceItem.findMany({
        where: { productId: { in: productIds } },
        include: { service: { select: { code: true, name: true } } },
      })
    : [];

  return ok({
    items,
    norms: norms.map((n) => ({
      productId: n.productId,
      quantity: n.quantity,
      serviceCode: n.service.code,
      serviceName: n.service.name,
    })),
  });
});
