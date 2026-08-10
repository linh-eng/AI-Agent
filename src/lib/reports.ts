// =============================================================================
// Báo cáo Nhập – Xuất – Tồn (N-X-T) theo khoảng thời gian, tùy chọn theo kho.
// Tính từ sổ cái StockMovement:
//   tồn đầu  = tổng biến động trước "từ ngày"
//   nhập     = tổng biến động dương trong kỳ
//   xuất     = tổng |biến động âm| trong kỳ
//   tồn cuối = tồn đầu + nhập − xuất
// =============================================================================
import { prisma } from "./prisma";

export interface NxtRow {
  productId: string;
  sku: string;
  name: string;
  uom: string;
  category: string | null;
  opening: number;
  inQty: number;
  outQty: number;
  closing: number;
}

export async function getNxtReport(
  from: Date,
  to: Date,
  warehouseId?: string | null
): Promise<NxtRow[]> {
  const toEnd = new Date(to);
  toEnd.setHours(23, 59, 59, 999);

  const movements = await prisma.stockMovement.findMany({
    where: {
      createdAt: { lte: toEnd },
      ...(warehouseId ? { warehouseId } : {}),
    },
    select: { productId: true, quantity: true, createdAt: true },
  });

  interface Acc {
    opening: number;
    inQty: number;
    outQty: number;
  }
  const acc = new Map<string, Acc>();
  for (const m of movements) {
    const a = acc.get(m.productId) ?? { opening: 0, inQty: 0, outQty: 0 };
    if (m.createdAt < from) {
      a.opening += m.quantity;
    } else {
      if (m.quantity >= 0) a.inQty += m.quantity;
      else a.outQty += -m.quantity;
    }
    acc.set(m.productId, a);
  }

  if (acc.size === 0) return [];

  const products = await prisma.product.findMany({
    where: { id: { in: Array.from(acc.keys()) } },
    include: { category: true },
  });

  return products
    .map((p) => {
      const a = acc.get(p.id)!;
      return {
        productId: p.id,
        sku: p.sku,
        name: p.name,
        uom: p.uom,
        category: p.category?.name ?? null,
        opening: a.opening,
        inQty: a.inQty,
        outQty: a.outQty,
        closing: a.opening + a.inQty - a.outQty,
      };
    })
    .sort((a, b) => a.sku.localeCompare(b.sku));
}
