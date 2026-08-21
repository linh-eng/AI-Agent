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
  userId: string
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
    // Liên kết theo MÃ HÀNG HÓA (mọi sản phẩm được tiêu hao đều ghi nhận sang Kho Dịch Vụ),
    // KHÔNG phụ thuộc việc có/không có HSD. Có HSD (PAO nhóm) thì tính hạn sau mở, không thì để trống.
    if (!p || c.qty <= EPS) continue;

    let need = c.qty;

    // 1) Trừ vào các hộp đang mở (cũ nhất trước).
    const active = await prisma.serviceStockItem.findMany({
      where: { productId: p.id, status: "IN_USE", remainingQty: { gt: 0 } },
      orderBy: { openedDate: "asc" },
    });
    for (const it of active) {
      if (need <= EPS) break;
      const take = Math.min(it.remainingQty, need);
      const rem = round4(it.remainingQty - take);
      await prisma.serviceStockItem.update({
        where: { id: it.id },
        data: { remainingQty: rem, status: rem <= EPS ? "EMPTY" : "IN_USE", updatedById: userId },
      });
      need = round4(need - take);
    }

    // 2) Còn thiếu -> mở hộp mới (mỗi hộp = 1 đơn vị), tính HSD sau mở theo PAO.
    const pao = p.category?.openMaxMonths ?? null;
    let guard = 0;
    while (need > EPS && guard < 1000) {
      guard++;
      const cap = 1;
      const take = Math.min(cap, need);
      const rem = round4(cap - take);
      await prisma.serviceStockItem.create({
        data: {
          productId: p.id,
          warehouseId: warehouseId ?? null,
          openedDate: now,
          expiryDate: pao ? addMonths(now, pao) : null,
          initialQty: cap,
          remainingQty: rem,
          status: rem <= EPS ? "EMPTY" : "IN_USE",
          openedById: userId,
          updatedById: userId,
        },
      });
      need = round4(need - take);
    }
  }
}
