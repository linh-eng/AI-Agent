export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { created, fail, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { kpiBonusRuleSchema } from "@/lib/clinic-validation";

export const POST = handle(async (req) => {
  await requirePermission(PERMISSIONS.COMPENSATION_POLICY_WRITE);
  const input = kpiBonusRuleSchema.parse(await req.json());
  const v = await prisma.compensationPolicyVersion.findUnique({ where: { id: input.policyVersionId }, select: { status: true } });
  if (!v) return fail(404, "Không tìm thấy phiên bản chính sách");
  if (v.status !== "DRAFT") return fail(409, "Chỉ thêm rule vào phiên bản DRAFT (PUBLISHED bất biến)");
  const rec = await prisma.kpiBonusRule.create({ data: {
    policyVersionId: input.policyVersionId, code: input.code, kpiDefinitionId: input.kpiDefinitionId,
    comparator: (input.comparator as any) ?? "GTE", threshold: input.threshold as any, bonusType: (input.bonusType as any) ?? "FIXED",
    fixedAmount: input.fixedAmount ?? null, rate: input.rate ?? null, tier: input.tier ?? 0,
    requireVerified: input.requireVerified ?? true, priority: input.priority ?? 0, isActive: input.isActive ?? true,
  } as any });
  return created(rec);
});
