export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { addMonths } from "@/lib/inventory";

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

  // NGÀY MỞ NẮP ưu tiên lấy theo SẢN PHẨM (nếu đã nhập), không dùng ngày ghi nhận lên hệ thống.
  // HSD sau mở nắp = MIN( HSD bao bì (sản phẩm), ngày mở + PAO nhóm ) — PAO là GIỚI HẠN TỐI ĐA.
  const items = uniq.map((it) => {
    const openedDate = it.product.openedDate ?? it.openedDate; // ngày mở nắp thực tế
    const pao = it.product.category?.openMaxMonths ?? null;
    const paoDate: Date | null = pao ? addMonths(new Date(openedDate), pao) : null;
    const packaging = it.expiryDate ?? it.product.expiryDate ?? null;
    let expiryDate: Date | null;
    if (paoDate && packaging) expiryDate = paoDate < packaging ? paoDate : packaging;
    else expiryDate = paoDate ?? packaging;
    const onHand = onHandByProduct.get(it.productId) ?? 0;
    return { ...it, openedDate, expiryDate, remainingQty: onHand, status: onHand <= 0 ? "EMPTY" : "IN_USE" };
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
