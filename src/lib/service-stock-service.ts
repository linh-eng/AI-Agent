// =============================================================================
// Kho Dịch Vụ — theo dõi hàng đã MỞ NẮP dùng dở cho dịch vụ.
// Khi Ghi nhận dịch vụ tiêu hao 1 sản phẩm (chỉ hàng requiresExpiry = có mở nắp),
// hệ thống trừ dần vào "hộp đang mở" cũ nhất; hết thì tự MỞ hộp mới (1 đơn vị) và
// tính HSD sau mở = ngày mở + PAO (openMaxMonths của nhóm). Đây là sổ theo dõi
// riêng cho khu dịch vụ, không thay đổi sổ tồn kho chính.
// =============================================================================
import { prisma } from "./prisma";

const EPS = 1e-9;
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}

export interface ConsumedItem {
  productId: string;
  qty: number;
}

/**
 * Cập nhật Kho Dịch Vụ theo lượng tiêu hao của 1 lần ghi nhận dịch vụ.
 * Chỉ áp dụng cho sản phẩm requiresExpiry (hàng mở nắp/có HSD).
 */
export async function applyServiceStock(
  consumed: ConsumedItem[],
  warehouseId: string | null,
  userId: string,
  serviceId: string | null = null
): Promise<void> {
  const ids = Array.from(new Set(consumed.map((c) => c.productId)));
  if (ids.length === 0) return;
  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    include: { category: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  const now = new Date();

  for (const c of consumed) {
    const p = byId.get(c.productId);
    // Liên kết theo MÃ HÀNG HÓA: mỗi sản phẩm được tiêu hao cho dịch vụ = 1 bản ghi "đang mở".
    // "Còn lại" hiển thị = TỒN THỰC TẾ của sản phẩm (tính động ở API), không phụ thuộc HSD.
    if (!p || c.qty <= EPS) continue;

    const existing = await prisma.serviceStockItem.findFirst({
      where: { productId: p.id, warehouseId: warehouseId ?? null, status: "IN_USE" },
    });
    if (existing) {
      // Đã mở rồi -> cập nhật người dùng cuối + liệu trình gần nhất (giữ ngày mở đầu tiên).
      await prisma.serviceStockItem.update({
        where: { id: existing.id },
        data: { updatedById: userId, serviceId: serviceId ?? existing.serviceId },
      });
    } else {
      // Mở mới: dùng ngày mở nắp / HSD của SẢN PHẨM nếu đã nhập, nếu không thì tính theo PAO nhóm.
      const pao = p.category?.openMaxMonths ?? null;
      const opened = p.openedDate ?? now;
      const exp = p.expiryDate ?? (pao ? addMonths(opened, pao) : null);
      await prisma.serviceStockItem.create({
        data: {
          productId: p.id,
          serviceId: serviceId ?? null,
          warehouseId: warehouseId ?? null,
          openedDate: opened,
          expiryDate: exp,
          initialQty: 1,
          remainingQty: 1,
          status: "IN_USE",
          openedById: userId,
          updatedById: userId,
        },
      });
    }
  }
}
