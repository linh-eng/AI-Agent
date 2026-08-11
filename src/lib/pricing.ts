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
