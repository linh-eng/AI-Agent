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

export interface ServiceRevenueRow {
  serviceId: string;
  code: string;
  name: string;
  usageCount: number; // số lần ghi nhận
  sessions: number; // tổng số lượt
  revenue: number;
  cost: number;
  profit: number;
}

/** Báo cáo doanh thu dịch vụ theo kỳ: doanh thu – giá vốn vật tư – lợi nhuận. */
export async function getServiceRevenueReport(
  from: Date,
  to: Date
): Promise<{ rows: ServiceRevenueRow[]; total: Omit<ServiceRevenueRow, "serviceId" | "code" | "name"> }> {
  const toEnd = new Date(to);
  toEnd.setHours(23, 59, 59, 999);

  const usages = await prisma.serviceUsage.findMany({
    where: { performedAt: { gte: from, lte: toEnd } },
    include: { service: { select: { code: true, name: true } } },
  });

  const map = new Map<string, ServiceRevenueRow>();
  for (const u of usages) {
    const r =
      map.get(u.serviceId) ??
      {
        serviceId: u.serviceId,
        code: u.service.code,
        name: u.service.name,
        usageCount: 0,
        sessions: 0,
        revenue: 0,
        cost: 0,
        profit: 0,
      };
    r.usageCount += 1;
    r.sessions += u.sessions;
    r.revenue += u.revenue ?? 0;
    r.cost += u.cost ?? 0;
    r.profit = r.revenue - r.cost;
    map.set(u.serviceId, r);
  }

  const rows = Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  const total = rows.reduce(
    (t, r) => ({
      usageCount: t.usageCount + r.usageCount,
      sessions: t.sessions + r.sessions,
      revenue: t.revenue + r.revenue,
      cost: t.cost + r.cost,
      profit: t.profit + r.profit,
    }),
    { usageCount: 0, sessions: 0, revenue: 0, cost: 0, profit: 0 }
  );
  return { rows, total };
}
