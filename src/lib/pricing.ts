// =============================================================================
// Module 9 — Price resolver. Chọn giá áp dụng theo target + thời điểm + loại giá.
// Ưu tiên: CUSTOM > CAMPAIGN > VIP > MEMBER > BRANCH > STANDARD.
// KHÔNG ghi đè lịch sử — chỉ đọc bản active còn hiệu lực.
// =============================================================================
import { prisma } from "./prisma";

const PRIORITY: Record<string, number> = {
  CUSTOM: 6,
  CAMPAIGN: 5,
  VIP: 4,
  MEMBER: 3,
  BRANCH: 2,
  STANDARD: 1,
};

/**
 * Loại giá được PHÉP áp cho một khách theo nhóm (member/VIP). Khách thường KHÔNG
 * được hưởng giá MEMBER/VIP; CAMPAIGN/CUSTOM/BRANCH áp cho mọi khách.
 */
export function priceTypesForCustomer(group?: string | null): string[] {
  const base = ["STANDARD", "BRANCH", "CAMPAIGN", "CUSTOM"];
  const g = (group ?? "").toUpperCase();
  if (g.includes("VIP")) return [...base, "MEMBER", "VIP"];
  if (g.includes("MEMBER") || g.includes("THÀNH VIÊN")) return [...base, "MEMBER"];
  return base;
}

export interface ResolveContext {
  at?: Date;
  branch?: string | null;
  types?: string[]; // giới hạn loại giá được xét (vd khách VIP: ['VIP','STANDARD'])
}

export interface ResolvedPrice {
  price: number;
  priceType: string;
  ruleId: string;
}

/** Giá áp dụng tốt nhất cho 1 target tại thời điểm `at`. null nếu không có. */
export async function resolvePrice(
  targetType: string,
  targetId: string,
  ctx: ResolveContext = {}
): Promise<ResolvedPrice | null> {
  const at = ctx.at ?? new Date();
  const rules = await prisma.priceRule.findMany({
    where: {
      targetType: targetType as any,
      targetId,
      isActive: true,
      AND: [
        { OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: at } }] },
        { OR: [{ effectiveTo: null }, { effectiveTo: { gte: at } }] },
      ],
      ...(ctx.branch ? { OR: [{ branch: null }, { branch: ctx.branch }] } : {}),
    },
  });

  const allowed = ctx.types;
  const candidates = rules.filter((r) => !allowed || allowed.includes(r.priceType));
  if (!candidates.length) return null;

  candidates.sort((a, b) => {
    const pd = (PRIORITY[b.priceType] ?? 0) - (PRIORITY[a.priceType] ?? 0);
    if (pd !== 0) return pd;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
  const best = candidates[0];
  return { price: Number(best.price), priceType: best.priceType, ruleId: best.id };
}

const ITEM_TO_TARGET: Record<string, string | null> = {
  SERVICE: "SERVICE",
  PRODUCT: "PRODUCT",
  TECHNOLOGY: "TECHNOLOGY",
  BRAND_PROTOCOL: null, // protocol không có giá độc lập
  CUSTOM: null,
};

/**
 * Giá bán (snapshot) + giá vốn cho một hạng mục báo giá / dịch vụ / sản phẩm.
 * Ưu tiên PriceRule còn hiệu lực (theo nhóm khách); fallback giá niêm yết của entity.
 * Giá vốn lấy từ entity (Service.expectedCost / SpaProduct.cost) — dùng nội bộ.
 */
export async function resolveItemPricing(
  itemType: string,
  refId: string | null | undefined,
  group?: string | null,
  at?: Date
): Promise<{ unitPrice: number | null; unitCost: number | null }> {
  if (!refId) return { unitPrice: null, unitCost: null };
  const targetType = ITEM_TO_TARGET[itemType];
  const types = priceTypesForCustomer(group);

  let unitPrice: number | null = null;
  let unitCost: number | null = null;

  if (targetType) {
    const resolved = await resolvePrice(targetType, refId, { at, types });
    if (resolved) unitPrice = resolved.price;
  }

  if (itemType === "SERVICE") {
    const s = await prisma.service.findUnique({ where: { id: refId }, select: { standardPrice: true, expectedCost: true } });
    if (unitPrice === null && s) unitPrice = Number(s.standardPrice);
    if (s?.expectedCost != null) unitCost = Number(s.expectedCost);
  } else if (itemType === "PRODUCT") {
    const p = await prisma.spaProduct.findUnique({ where: { id: refId }, select: { sellingPrice: true, cost: true } });
    if (unitPrice === null && p?.sellingPrice != null) unitPrice = Number(p.sellingPrice);
    if (p?.cost != null) unitCost = Number(p.cost);
  }
  return { unitPrice, unitCost };
}

/**
 * Điền giá bán/giá vốn cho hạng mục các phương án báo giá chưa có giá — snapshot
 * tại thời điểm lập. Sửa trực tiếp mảng options (mutate).
 */
export async function enrichProposalOptions(options: any[], group?: string | null) {
  for (const o of options) {
    for (const it of o.items ?? []) {
      if ((it.unitPrice === undefined || it.unitPrice === null) && it.refId) {
        const r = await resolveItemPricing(it.itemType, it.refId, group);
        if (r.unitPrice !== null) it.unitPrice = r.unitPrice;
        if ((it.unitCost === undefined || it.unitCost === null) && r.unitCost !== null) it.unitCost = r.unitCost;
      }
    }
  }
  return options;
}
