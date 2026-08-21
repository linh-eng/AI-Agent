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
          id: true, sku: true, name: true, uom: true,
          category: { select: { name: true, openMaxMonths: true } },
        },
      },
      service: { select: { id: true, code: true, name: true } },
      openedBy: { select: { name: true } },
      updatedBy: { select: { name: true } },
    },
    orderBy: [{ status: "asc" }, { openedDate: "asc" }],
  });

  // HSD sau mở = HSD đã lưu, hoặc tính động = ngày mở + PAO hiện tại của nhóm hàng.
  const items = raw.map((it) => {
    let expiryDate = it.expiryDate;
    const pao = it.product.category?.openMaxMonths ?? null;
    if (!expiryDate && pao) {
      const d = new Date(it.openedDate);
      d.setMonth(d.getMonth() + pao);
      expiryDate = d;
    }
    return { ...it, expiryDate };
  });

  // Định mức tiêu hao theo từng dịch vụ cho các sản phẩm đang có trong kho dịch vụ.
  const productIds = Array.from(new Set(items.map((i) => i.productId)));
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
