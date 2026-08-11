export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission, getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { priceRuleCreateSchema } from "@/lib/ext-validation";
import { auditLog } from "@/lib/clinic";

export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.PRICE_READ);
  const url = new URL(req.url);
  const targetType = url.searchParams.get("targetType") ?? undefined;
  const targetId = url.searchParams.get("targetId") ?? undefined;
  const includeArchived = url.searchParams.get("all") === "1";
  const rules = await prisma.priceRule.findMany({
    where: {
      ...(targetType ? { targetType: targetType as any } : {}),
      ...(targetId ? { targetId } : {}),
      ...(includeArchived ? {} : { isActive: true }),
    },
    orderBy: [{ targetType: "asc" }, { createdAt: "desc" }],
    take: 400,
  });
  return ok(rules);
});

// Tạo bản giá mới. Đổi giá = tạo bản mới + archive bản cũ (append-only, giữ lịch sử).
export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.PRICE_WRITE);
  const parsed = priceRuleCreateSchema.parse(await req.json());

  let version = 1;
  const rule = await prisma.$transaction(async (tx) => {
    if (parsed.supersedesId) {
      const old = await tx.priceRule.findUnique({ where: { id: parsed.supersedesId } });
      if (old) {
        version = old.version + 1;
        await tx.priceRule.update({ where: { id: old.id }, data: { isActive: false } });
      }
    }
    return tx.priceRule.create({
      data: {
        targetType: parsed.targetType,
        targetId: parsed.targetId,
        targetName: parsed.targetName ?? null,
        priceType: parsed.priceType,
        branch: parsed.branch ?? null,
        price: parsed.price,
        effectiveFrom: parsed.effectiveFrom,
        effectiveTo: parsed.effectiveTo,
        campaign: parsed.campaign ?? null,
        note: parsed.note ?? null,
        version,
        supersedesId: parsed.supersedesId ?? null,
        createdBy: session.name,
      },
    });
  });

  await auditLog({
    userId: session.userId,
    action: "PRICE_SET",
    entityType: "PriceRule",
    entityId: rule.id,
    changes: { targetType: rule.targetType, targetId: rule.targetId, price: parsed.price, priceType: rule.priceType },
  });
  return created(rule);
});
