// =============================================================================
// PRICING / COSTING — PH3: RECOMMENDED PRICE / TARGET MARGIN
// Lớp GIÁ ĐỀ XUẤT độc lập (decision-support): với giá vốn + biên MỤC TIÊU, nên bán
// ở mức nào. Tham chiếu ServiceCostingVersion PUBLISHED; công thức MARGIN chuẩn.
//  * KHÁC Floor (giá bán tối thiểu) & KHÁC PriceRule (giá bán thực tế theo segment).
//  * Ràng buộc: targetMargin ≥ minMargin của Floor ACTIVE + recommended ≥ giá sàn (nếu có Floor).
//  * Versioned; PUBLISHED bất biến. KHÔNG ghi ngược standardPrice/PriceRule/Floor/Costing.
// =============================================================================
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { computeFloorPrice, activeFloorVersion } from "./price-floor";

function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  return typeof v === "number" ? v : Number(v);
}

export class RecommendedPriceError extends Error {
  status: number;
  constructor(message: string, status = 409) { super(message); this.status = status; }
}

/** Giá đề xuất theo biên MỤC TIÊU: cost / (1 − target%), ceil theo roundingUnit (dùng lại computeFloorPrice MARGIN). */
export function computeRecommendedPrice(totalCost: number, targetMarginPercent: number, roundingUnit = 1000): number {
  return computeFloorPrice({ totalCost: num(totalCost), method: "MARGIN", minMarginPercent: num(targetMarginPercent), roundingUnit });
}

interface RecommendedInputs {
  targetMarginPercent: number;
  roundingUnit?: number;
}

/**
 * Tính + KIỂM TRA ràng buộc Floor cho một Recommended Price của (service, costing PUBLISHED).
 *  - Costing phải PUBLISHED + thuộc dịch vụ.
 *  - Nếu có Floor ACTIVE: targetMargin ≥ minMargin(floor) (§5) VÀ recommended ≥ floorPrice (§6) → else 422.
 *    (Chọn VALIDATION, không clamp — giữ đúng semantics biên mục tiêu.)
 * Trả về các trường đã tính (chưa ghi DB).
 */
async function computeAndValidate(serviceId: string, serviceCostingVersionId: string, input: RecommendedInputs, tx: Prisma.TransactionClient = prisma) {
  const costing = await tx.serviceCostingVersion.findUnique({ where: { id: serviceCostingVersionId } });
  if (!costing) throw new RecommendedPriceError("Không tìm thấy version giá vốn", 404);
  if (costing.serviceId !== serviceId) throw new RecommendedPriceError("Version giá vốn không thuộc dịch vụ này", 422);
  if (costing.status !== "PUBLISHED") throw new RecommendedPriceError("Chỉ tạo giá đề xuất từ version giá vốn ĐÃ PHÁT HÀNH (PUBLISHED)", 422);

  const costSnapshot = num(costing.totalEstimatedCost);
  const roundingUnit = input.roundingUnit ?? 1000;
  const recommended = computeRecommendedPrice(costSnapshot, input.targetMarginPercent, roundingUnit);

  // Ràng buộc Floor ACTIVE (nếu có).
  const floor = await activeFloorVersion(serviceId);
  let floorVersionId: string | null = null;
  let floorPriceSnapshot: number | null = null;
  if (floor) {
    floorVersionId = floor.id;
    floorPriceSnapshot = num(floor.floorPrice);
    const floorMargin = num(floor.minMarginPercent);
    // §5: biên mục tiêu KHÔNG được thấp hơn biên tối thiểu của giá sàn.
    if (num(input.targetMarginPercent) + 1e-9 < floorMargin)
      throw new RecommendedPriceError(`Biên mục tiêu (${num(input.targetMarginPercent)}%) không được thấp hơn biên tối thiểu của giá sàn (${floorMargin}%)`, 422);
    // §6: giá đề xuất KHÔNG được thấp hơn giá sàn đang hiệu lực.
    if (recommended + 1e-6 < floorPriceSnapshot)
      throw new RecommendedPriceError(`Giá đề xuất (${recommended}) thấp hơn giá sàn đang hiệu lực (${floorPriceSnapshot})`, 422);
  }

  return { costSnapshot, roundingUnit, recommended, floorVersionId, floorPriceSnapshot };
}

/** Tạo Recommended Price version DRAFT (tính + kiểm tra ràng buộc Floor). */
export async function createRecommendedVersion(input: {
  serviceId: string; serviceCostingVersionId: string; targetMarginPercent: number;
  roundingUnit?: number; note?: string | null; createdBy?: string | null;
}) {
  const service = await prisma.service.findUnique({ where: { id: input.serviceId }, select: { id: true } });
  if (!service) throw new RecommendedPriceError("Không tìm thấy dịch vụ", 404);
  const c = await computeAndValidate(input.serviceId, input.serviceCostingVersionId, input);

  const last = await prisma.serviceRecommendedPriceVersion.findFirst({ where: { serviceId: input.serviceId }, orderBy: { version: "desc" }, select: { version: true } });
  const nextVersion = (last?.version ?? 0) + 1;

  return prisma.serviceRecommendedPriceVersion.create({
    data: {
      serviceId: input.serviceId, serviceCostingVersionId: input.serviceCostingVersionId, version: nextVersion, status: "DRAFT",
      targetMarginPercent: input.targetMarginPercent, costSnapshot: c.costSnapshot, roundingUnit: c.roundingUnit,
      calculatedRecommendedPrice: c.recommended, floorVersionId: c.floorVersionId, floorPriceSnapshot: c.floorPriceSnapshot,
      note: input.note ?? null, createdBy: input.createdBy ?? null,
    },
  });
}

/** Sửa DRAFT (đổi biên mục tiêu / làm tròn) + tính lại + kiểm tra ràng buộc. */
export async function updateRecommendedVersion(versionId: string, patch: {
  targetMarginPercent?: number; roundingUnit?: number; note?: string | null;
}) {
  const v = await prisma.serviceRecommendedPriceVersion.findUnique({ where: { id: versionId } });
  if (!v) throw new RecommendedPriceError("Không tìm thấy version giá đề xuất", 404);
  if (v.status !== "DRAFT") throw new RecommendedPriceError("Chỉ sửa được version ở trạng thái Bản nháp", 409);

  const targetMarginPercent = patch.targetMarginPercent !== undefined ? patch.targetMarginPercent : num(v.targetMarginPercent);
  const roundingUnit = patch.roundingUnit !== undefined ? patch.roundingUnit : v.roundingUnit;
  const c = await computeAndValidate(v.serviceId, v.serviceCostingVersionId, { targetMarginPercent, roundingUnit });

  return prisma.serviceRecommendedPriceVersion.update({
    where: { id: versionId },
    data: {
      targetMarginPercent, roundingUnit, costSnapshot: c.costSnapshot, calculatedRecommendedPrice: c.recommended,
      floorVersionId: c.floorVersionId, floorPriceSnapshot: c.floorPriceSnapshot,
      ...(patch.note !== undefined ? { note: patch.note } : {}),
    },
  });
}

/** Tính lại DRAFT từ costing đã tham chiếu + Floor hiện tại (không đổi biên đã lưu). */
export async function recalculateRecommendedVersion(versionId: string) {
  const v = await prisma.serviceRecommendedPriceVersion.findUnique({ where: { id: versionId } });
  if (!v) throw new RecommendedPriceError("Không tìm thấy version giá đề xuất", 404);
  if (v.status !== "DRAFT") throw new RecommendedPriceError("Chỉ tính lại được version Bản nháp", 409);
  const c = await computeAndValidate(v.serviceId, v.serviceCostingVersionId, { targetMarginPercent: num(v.targetMarginPercent), roundingUnit: v.roundingUnit });
  return prisma.serviceRecommendedPriceVersion.update({
    where: { id: versionId },
    data: { costSnapshot: c.costSnapshot, calculatedRecommendedPrice: c.recommended, floorVersionId: c.floorVersionId, floorPriceSnapshot: c.floorPriceSnapshot },
  });
}

/** Phát hành DRAFT → PUBLISHED (re-validate ràng buộc Floor hiện tại). PUBLISHED cũ → SUPERSEDED. */
export async function publishRecommendedVersion(versionId: string, actor?: string | null) {
  const v = await prisma.serviceRecommendedPriceVersion.findUnique({ where: { id: versionId } });
  if (!v) throw new RecommendedPriceError("Không tìm thấy version giá đề xuất", 404);
  if (v.status !== "DRAFT") throw new RecommendedPriceError("Chỉ phát hành được version Bản nháp", 409);
  // Re-validate + snapshot lại theo trạng thái hiện tại (Floor có thể đã đổi).
  const c = await computeAndValidate(v.serviceId, v.serviceCostingVersionId, { targetMarginPercent: num(v.targetMarginPercent), roundingUnit: v.roundingUnit });

  return prisma.$transaction(async (tx) => {
    const prev = await tx.serviceRecommendedPriceVersion.findFirst({
      where: { serviceId: v.serviceId, status: "PUBLISHED", id: { not: versionId } },
      orderBy: { version: "desc" }, select: { id: true },
    });
    if (prev) {
      await tx.serviceRecommendedPriceVersion.updateMany({
        where: { serviceId: v.serviceId, status: "PUBLISHED", id: { not: versionId } },
        data: { status: "SUPERSEDED" },
      });
    }
    return tx.serviceRecommendedPriceVersion.update({
      where: { id: versionId },
      data: {
        status: "PUBLISHED", publishedBy: actor ?? null, publishedAt: new Date(), supersedesId: prev?.id ?? null,
        costSnapshot: c.costSnapshot, calculatedRecommendedPrice: c.recommended, floorVersionId: c.floorVersionId, floorPriceSnapshot: c.floorPriceSnapshot,
      },
    });
  });
}

/** Version PUBLISHED hiện hành của một dịch vụ (nếu có). */
export async function activeRecommendedVersion(serviceId: string) {
  return prisma.serviceRecommendedPriceVersion.findFirst({ where: { serviceId, status: "PUBLISHED" }, orderBy: { version: "desc" } });
}

// -----------------------------------------------------------------------------
// Finance mask — targetMargin + costSnapshot nhạy cảm; giá đề xuất giữ visibility
// như Floor (guardrail). Non-finance không suy được cost vì margin bị ẩn (§15).
// -----------------------------------------------------------------------------
export const RECOMMENDED_SENSITIVE_FIELDS = ["targetMarginPercent", "costSnapshot"] as const;
export function maskRecommended<T extends Record<string, any>>(obj: T, canSee: boolean): T {
  if (canSee) return obj;
  const clone: Record<string, any> = { ...obj };
  for (const f of RECOMMENDED_SENSITIVE_FIELDS) if (f in clone) clone[f] = null;
  return clone as T;
}

/** So sánh giá bán hiện tại với Floor/Recommended (derived display — §13, không policy). */
export function priceComparisonBand(price: number, floorPrice: number | null, recommendedPrice: number | null): "BELOW_FLOOR" | "BETWEEN_FLOOR_AND_RECOMMENDED" | "AT_OR_ABOVE_RECOMMENDED" | null {
  const p = num(price);
  if (floorPrice != null && p + 1e-6 < num(floorPrice)) return "BELOW_FLOOR";
  if (recommendedPrice != null && p + 1e-6 < num(recommendedPrice)) return "BETWEEN_FLOOR_AND_RECOMMENDED";
  if (recommendedPrice != null) return "AT_OR_ABOVE_RECOMMENDED";
  return null;
}
