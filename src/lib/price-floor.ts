// =============================================================================
// GIÁ SÀN (mục 25–26) — tính tổng chi phí cấu thành + giá sàn, và kiểm tra
// bán dưới sàn. Chi phí nhạy cảm (chỉ finance.read xem).
// =============================================================================
import { prisma } from "./prisma";

function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  return typeof v === "number" ? v : Number(v);
}

export interface FloorComponents {
  laborCost?: number;
  operationCost?: number;
  depreciationCost?: number;
  materialCost?: number;
  roomCost?: number;
  otherCost?: number;
  minMarginPercent?: number;
}

/** Tổng chi phí = Σ 6 thành phần. Giá sàn = tổng chi phí × (1 + biên tối thiểu%). */
export function computeFloor(c: FloorComponents): { totalCost: number; floorPrice: number } {
  const totalCost =
    num(c.laborCost) + num(c.operationCost) + num(c.depreciationCost) +
    num(c.materialCost) + num(c.roomCost) + num(c.otherCost);
  const floorPrice = Math.round(totalCost * (1 + num(c.minMarginPercent) / 100));
  return { totalCost, floorPrice };
}

export interface FloorCheck {
  hasFloor: boolean;
  totalCost: number;
  floorPrice: number;
  price: number;
  below: boolean; // price < floorPrice
  shortfall: number; // floorPrice - price (>=0)
}

/**
 * Kiểm tra một mức giá so với giá sàn của dịch vụ. Nếu dịch vụ chưa khai báo cấu
 * trúc chi phí → hasFloor=false (không chặn).
 */
export async function checkServicePriceFloor(serviceId: string, price: number): Promise<FloorCheck> {
  const floor = await prisma.servicePriceFloor.findUnique({ where: { serviceId } });
  if (!floor) {
    return { hasFloor: false, totalCost: 0, floorPrice: 0, price, below: false, shortfall: 0 };
  }
  const { totalCost, floorPrice } = computeFloor({
    laborCost: num(floor.laborCost),
    operationCost: num(floor.operationCost),
    depreciationCost: num(floor.depreciationCost),
    materialCost: num(floor.materialCost),
    roomCost: num(floor.roomCost),
    otherCost: num(floor.otherCost),
    minMarginPercent: num(floor.minMarginPercent),
  });
  const below = price + 1e-6 < floorPrice;
  return { hasFloor: true, totalCost, floorPrice, price, below, shortfall: below ? floorPrice - price : 0 };
}

/**
 * Tổng giá sàn của một phương án báo giá = Σ giá sàn từng hạng mục DỊCH VỤ
 * (itemType SERVICE, refId=serviceId) × số buổi/số lượng. Hạng mục không phải
 * dịch vụ hoặc dịch vụ chưa khai báo giá sàn không cộng vào (floorApplicable=false).
 * Dùng để cảnh báo/chặn khi giá chốt phương án thấp hơn tổng giá sàn (mục 26).
 */
export async function proposalOptionFloorTotal(
  items: Array<{ itemType: string; refId?: string | null; quantity?: number | null; sessions?: number | null }>,
  agreedPrice: number
): Promise<{ floorApplicable: boolean; floorTotal: number; below: boolean; shortfall: number }> {
  let floorTotal = 0;
  let floorApplicable = false;
  for (const it of items) {
    if (it.itemType !== "SERVICE" || !it.refId) continue;
    const fc = await checkServicePriceFloor(it.refId, 0);
    if (!fc.hasFloor) continue;
    floorApplicable = true;
    const times = num(it.sessions ?? it.quantity ?? 1) || 1;
    floorTotal += fc.floorPrice * times;
  }
  const below = floorApplicable && agreedPrice + 1e-6 < floorTotal;
  return { floorApplicable, floorTotal, below, shortfall: below ? floorTotal - agreedPrice : 0 };
}
