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

// Provenance nguồn giá sàn dùng để validate (PH2 — nội bộ, không leak cost).
export type FloorSource = "V2_COSTING" | "LEGACY_V2" | "LEGACY_V1" | null;

export interface FloorCheck {
  hasFloor: boolean;
  totalCost: number;
  floorPrice: number;
  price: number;
  below: boolean; // price < floorPrice
  shortfall: number; // floorPrice - price (>=0)
  floorVersionId?: string | null; // version giá sàn dùng để đối chiếu (v2)
  standardPrice?: number; // giá chuẩn dịch vụ tại thời điểm
  maxDiscount?: number;
  maxDiscountPercent?: number;
  version?: number | null;
  source?: FloorSource; // PH2: V2_COSTING > LEGACY_V2 > LEGACY_V1
  serviceCostingVersionId?: string | null; // nếu floor v2 tham chiếu Costing
}

// =============================================================================
// GIÁ SÀN v2 (mục 7) — cost breakdown theo dòng, margin formula, version.
// =============================================================================
export const COST_CATEGORIES = ["MATERIAL", "STAFF", "MACHINE", "ROOM", "OPERATION", "OTHER"] as const;
export type CostCategoryKey = (typeof COST_CATEGORIES)[number];

export interface CostLineInput {
  category: string;
  quantity?: number | null;
  unit?: string | null;
  unitCost?: number | null;
  calcType?: string | null;
  calcValue?: number | null;
  minutes?: number | null;
}

/**
 * Thành tiền một dòng chi phí (trừ OPERATION/PERCENT_DIRECT phải tính sau vì phụ
 * thuộc chi phí trực tiếp). Trả về null nếu là dòng % trên chi phí trực tiếp.
 */
export function computeLineBaseAmount(line: CostLineInput, minutesDefault = 0): number | null {
  const q = num(line.quantity) || 0;
  const uc = num(line.unitCost);
  const cv = num(line.calcValue);
  const mins = line.minutes != null && line.minutes !== undefined ? num(line.minutes) : num(minutesDefault);
  switch (line.calcType) {
    case "PER_MINUTE":
    case "PER_DURATION":
      return cv * mins;
    case "PER_USE":
      return (cv > 0 ? cv : uc) * (q || 1);
    case "PER_SESSION":
      return cv > 0 ? cv : q * uc;
    case "PERCENT_DIRECT":
      return null; // tính sau khi có chi phí trực tiếp
    case "FIXED":
    default:
      return cv > 0 ? cv : q * uc;
  }
}

export interface VersionCostResult {
  lineAmounts: number[];
  byCategory: Record<CostCategoryKey, number>;
  directCost: number; // Σ mọi nhóm trừ OPERATION
  totalCost: number;
}

/** Tính chi phí toàn version: 2 pha (chi phí trực tiếp → vận hành % trên trực tiếp). */
export function computeVersionCost(lines: CostLineInput[], minutesDefault = 0): VersionCostResult {
  const byCategory: Record<CostCategoryKey, number> = { MATERIAL: 0, STAFF: 0, MACHINE: 0, ROOM: 0, OPERATION: 0, OTHER: 0 };
  const lineAmounts = new Array<number>(lines.length).fill(0);

  // Pha 1: mọi dòng KHÔNG phải % trực tiếp.
  let directCost = 0;
  lines.forEach((l, i) => {
    const base = computeLineBaseAmount(l, minutesDefault);
    if (base === null) return; // để pha 2
    lineAmounts[i] = base;
    const cat = (COST_CATEGORIES.includes(l.category as CostCategoryKey) ? l.category : "OTHER") as CostCategoryKey;
    byCategory[cat] += base;
    if (cat !== "OPERATION") directCost += base;
  });

  // Pha 2: OPERATION theo % chi phí trực tiếp.
  lines.forEach((l, i) => {
    if (l.calcType !== "PERCENT_DIRECT") return;
    const amt = (directCost * num(l.calcValue)) / 100;
    lineAmounts[i] = amt;
    byCategory.OPERATION += amt;
  });

  const totalCost = COST_CATEGORIES.reduce((s, c) => s + byCategory[c], 0);
  return { lineAmounts, byCategory, directCost, totalCost };
}

/** Giá sàn theo phương pháp. MARGIN (mặc định): tổng giá vốn / (1 - margin%). */
export function computeFloorPrice(input: {
  totalCost: number;
  method?: string;
  minMarginPercent?: number;
  manualFloorPrice?: number | null;
  roundingUnit?: number;
}): number {
  const total = num(input.totalCost);
  const m = num(input.minMarginPercent) / 100;
  const round = num(input.roundingUnit) || 1;
  let raw: number;
  if (input.method === "MANUAL") raw = num(input.manualFloorPrice);
  else if (input.method === "MARKUP") raw = total * (1 + m);
  else raw = m >= 1 ? total : total / (1 - m); // MARGIN mặc định; biên 100% vô nghĩa → dùng total
  // Làm tròn LÊN theo đơn vị; trừ epsilon để tránh sai số dấu phẩy động (vd 1.4M/0.7
  // = 2000000.0000002 → không được thành 2000001). Bội số đúng vẫn giữ nguyên.
  return Math.ceil(raw / round - 1e-9) * round;
}

/** Chiết khấu tối đa từ giá chuẩn xuống giá sàn. */
export function maxDiscount(standard: number, floor: number): { amount: number; percent: number } {
  const amount = Math.max(0, num(standard) - num(floor));
  const percent = num(standard) > 0 ? (amount / num(standard)) * 100 : 0;
  return { amount, percent: Math.round(percent * 100) / 100 };
}

/**
 * Version giá sàn ĐANG HIỆU LỰC của dịch vụ tại thời điểm `at` (mặc định now).
 * Chỉ status ACTIVE và trong khoảng effectiveFrom..effectiveTo (nửa mở phải).
 */
export async function activeFloorVersion(serviceId: string, at: Date = new Date()) {
  const versions = await prisma.servicePriceFloorVersion.findMany({
    where: { serviceId, status: "ACTIVE" },
    orderBy: { version: "desc" },
  });
  return versions.find((v) => {
    const from = v.effectiveFrom ? new Date(v.effectiveFrom) : null;
    const to = v.effectiveTo ? new Date(v.effectiveTo) : null;
    if (from && from.getTime() > at.getTime()) return false;
    if (to && to.getTime() < at.getTime()) return false;
    return true;
  }) ?? null;
}

/**
 * Kiểm tra một mức giá so với giá sàn của dịch vụ.
 *  - Ưu tiên VERSION đang hiệu lực (v2); nếu không có, fallback model cũ (v1).
 *  - Dịch vụ chưa khai báo → hasFloor=false (không chặn).
 */
export async function checkServicePriceFloor(serviceId: string, price: number, at: Date = new Date()): Promise<FloorCheck> {
  const service = await prisma.service.findUnique({ where: { id: serviceId }, select: { standardPrice: true } });
  const standardPrice = num(service?.standardPrice);

  // v2: version đang hiệu lực (snapshot).
  const active = await activeFloorVersion(serviceId, at);
  if (active) {
    const floorPrice = num(active.floorPrice);
    const below = price + 1e-6 < floorPrice;
    // Provenance PH2: version v2 tham chiếu Costing → V2_COSTING; ngược lại LEGACY_V2.
    const source: FloorSource = (active as any).serviceCostingVersionId ? "V2_COSTING" : "LEGACY_V2";
    return {
      hasFloor: true, totalCost: num(active.totalCost), floorPrice, price, below,
      shortfall: below ? floorPrice - price : 0, floorVersionId: active.id, standardPrice,
      maxDiscount: num(active.maxDiscount), maxDiscountPercent: num(active.maxDiscountPercent), version: active.version,
      source, serviceCostingVersionId: (active as any).serviceCostingVersionId ?? null,
    };
  }

  // v1 fallback (model cũ).
  const floor = await prisma.servicePriceFloor.findUnique({ where: { serviceId } });
  if (!floor) return { hasFloor: false, totalCost: 0, floorPrice: 0, price, below: false, shortfall: 0, standardPrice, source: null };
  const { totalCost, floorPrice } = computeFloor({
    laborCost: num(floor.laborCost), operationCost: num(floor.operationCost), depreciationCost: num(floor.depreciationCost),
    materialCost: num(floor.materialCost), roomCost: num(floor.roomCost), otherCost: num(floor.otherCost),
    minMarginPercent: num(floor.minMarginPercent),
  });
  const below = price + 1e-6 < floorPrice;
  const md = maxDiscount(standardPrice, floorPrice);
  return { hasFloor: true, totalCost, floorPrice, price, below, shortfall: below ? floorPrice - price : 0, floorVersionId: null, standardPrice, maxDiscount: md.amount, maxDiscountPercent: md.percent, version: null, source: "LEGACY_V1", serviceCostingVersionId: null };
}

/**
 * Dựng các dòng chi phí MẶC ĐỊNH cho một dịch vụ từ dữ liệu đã có (mục 5,7):
 *  - Vật tư: từ định mức dịch vụ (ServiceMaterialStandard), đơn giá cost lấy từ
 *    SpaProduct liên kết nếu có.
 *  - Nhân sự: từ staffRequirements của dịch vụ; gợi ý phí theo vai trò (trung bình
 *    defaultFee của nhân sự đang hoạt động có vai trò đó).
 *  - Máy/Phòng: từ resourceRequirements (nếu bắt buộc) — để trống đơn giá cho user nhập.
 */
export async function buildDefaultLinesFromService(serviceId: string): Promise<Array<Record<string, unknown>>> {
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    include: { materialStandards: { orderBy: { orderIndex: "asc" } } },
  });
  if (!service) return [];
  const lines: Array<Record<string, unknown>> = [];
  let order = 0;

  // Vật tư
  for (const m of service.materialStandards) {
    let unitCost = 0;
    if (m.spaProductId) {
      const prod = await prisma.spaProduct.findUnique({ where: { id: m.spaProductId }, select: { cost: true } });
      unitCost = num(prod?.cost);
    }
    lines.push({
      category: "MATERIAL", name: m.name, quantity: num(m.quantity) || 1, unit: m.unit, unitCost,
      calcType: "FIXED", refId: m.spaProductId ?? m.usageMaterialId ?? null, source: "Định mức dịch vụ",
      required: m.required, note: m.note ?? null, orderIndex: order++,
    });
  }

  // Nhân sự — gợi ý phí theo vai trò từ MASTER phí nhân sự (EmployeeRoleFee hiện hành,
  // mục 8/14); fallback defaultFee cũ. Giá sàn version publish sẽ snapshot (không đổi sau).
  const staffReq = Array.isArray(service.staffRequirements) ? (service.staffRequirements as any[]) : [];
  const now = new Date();
  for (const r of staffReq) {
    const role = String(r.role ?? "").trim();
    if (!role) continue;
    // Ưu tiên phí vai trò hiện hành (EmployeeRoleFee), else defaultFee.
    const roleFees = await prisma.employeeRoleFee.findMany({
      where: { role, isActive: true, effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }], employee: { status: "ACTIVE" } },
      select: { fee: true },
    });
    let fees = roleFees.map((f) => num(f.fee)).filter((x) => x > 0);
    if (fees.length === 0) {
      const emps = await prisma.employee.findMany({ where: { isActive: true, roles: { has: role } }, select: { defaultFee: true } });
      fees = emps.map((e) => num(e.defaultFee)).filter((x) => x > 0);
    }
    const suggested = fees.length ? Math.round(fees.reduce((s, x) => s + x, 0) / fees.length) : 0;
    lines.push({
      category: "STAFF", name: role, quantity: num(r.quantity) || 1, unit: "người", unitCost: suggested,
      calcType: "FIXED", source: fees.length ? "Fee vai trò (gợi ý)" : "Nhập tay", required: r.required !== false, orderIndex: order++,
    });
  }

  // Máy / Phòng (nếu bắt buộc)
  const res = (service.resourceRequirements ?? {}) as any;
  if (res?.machine?.required) lines.push({ category: "MACHINE", name: "Máy/thiết bị", quantity: 1, unit: "buổi", unitCost: 0, calcType: "PER_SESSION", calcValue: 0, minutes: service.machineMinutes ?? service.durationMinutes ?? null, source: "Cấu hình dịch vụ", required: true, orderIndex: order++ });
  if (res?.room?.required) lines.push({ category: "ROOM", name: "Phòng/giường", quantity: 1, unit: "buổi", unitCost: 0, calcType: "PER_SESSION", calcValue: 0, minutes: service.roomMinutes ?? service.durationMinutes ?? null, source: "Cấu hình dịch vụ", required: true, orderIndex: order++ });

  return lines;
}

/**
 * Tổng giá sàn của một phương án báo giá = Σ giá sàn từng hạng mục DỊCH VỤ
 * (itemType SERVICE, refId=serviceId) × số buổi/số lượng. Hạng mục không phải
 * dịch vụ hoặc dịch vụ chưa khai báo giá sàn không cộng vào (floorApplicable=false).
 * Dùng để cảnh báo/chặn khi giá chốt phương án thấp hơn tổng giá sàn (mục 26).
 */
export interface ProposalFloorDetail {
  serviceId: string;
  name?: string | null;
  floorPrice: number;
  times: number;
  lineFloor: number;
  floorVersionId?: string | null;
  version?: number | null;
}

export async function proposalOptionFloorTotal(
  items: Array<{ itemType: string; refId?: string | null; name?: string | null; quantity?: number | null; sessions?: number | null }>,
  agreedPrice: number
): Promise<{ floorApplicable: boolean; floorTotal: number; below: boolean; shortfall: number; details: ProposalFloorDetail[] }> {
  let floorTotal = 0;
  let floorApplicable = false;
  const details: ProposalFloorDetail[] = [];
  for (const it of items) {
    if (it.itemType !== "SERVICE" || !it.refId) continue;
    const fc = await checkServicePriceFloor(it.refId, 0);
    if (!fc.hasFloor) continue;
    floorApplicable = true;
    const times = num(it.sessions ?? it.quantity ?? 1) || 1;
    const lineFloor = fc.floorPrice * times;
    floorTotal += lineFloor;
    details.push({ serviceId: it.refId, name: it.name ?? null, floorPrice: fc.floorPrice, times, lineFloor, floorVersionId: fc.floorVersionId, version: fc.version });
  }
  const below = floorApplicable && agreedPrice + 1e-6 < floorTotal;
  return { floorApplicable, floorTotal, below, shortfall: below ? floorTotal - agreedPrice : 0, details };
}
