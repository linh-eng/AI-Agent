export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { created, fail, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { commissionRuleSchema } from "@/lib/clinic-validation";

export const POST = handle(async (req) => {
  await requirePermission(PERMISSIONS.COMPENSATION_POLICY_WRITE);
  const input = commissionRuleSchema.parse(await req.json());
  const v = await prisma.compensationPolicyVersion.findUnique({ where: { id: input.policyVersionId }, select: { status: true } });
  if (!v) return fail(404, "Không tìm thấy phiên bản chính sách");
  if (v.status !== "DRAFT") return fail(409, "Chỉ thêm rule vào phiên bản DRAFT (PUBLISHED bất biến)");
  const rec = await prisma.commissionRule.create({ data: {
    policyVersionId: input.policyVersionId, code: input.code, basisType: (input.basisType as any) ?? "COLLECTED_CASH",
    targetType: (input.targetType as any) ?? "ALL", targetId: input.targetId ?? null,
    ratePercent: input.ratePercent ?? null, fixedAmount: input.fixedAmount ?? null,
    thresholdMin: input.thresholdMin ?? null, thresholdMax: input.thresholdMax ?? null,
    attributionRole: (input.attributionRole as any) ?? null, priority: input.priority ?? 0, isActive: input.isActive ?? true,
  } as any });
  return created(rec);
});
