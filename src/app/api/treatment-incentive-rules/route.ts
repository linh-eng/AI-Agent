export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { created, fail, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { incentiveRuleSchema } from "@/lib/clinic-validation";

export const POST = handle(async (req) => {
  await requirePermission(PERMISSIONS.COMPENSATION_POLICY_WRITE);
  const input = incentiveRuleSchema.parse(await req.json());
  const v = await prisma.compensationPolicyVersion.findUnique({ where: { id: input.policyVersionId }, select: { status: true } });
  if (!v) return fail(404, "Không tìm thấy phiên bản chính sách");
  if (v.status !== "DRAFT") return fail(409, "Chỉ thêm rule vào phiên bản DRAFT (PUBLISHED bất biến)");
  const rec = await prisma.treatmentIncentiveRule.create({ data: {
    policyVersionId: input.policyVersionId, code: input.code, serviceId: input.serviceId ?? null, serviceCategoryId: input.serviceCategoryId ?? null,
    contributionTypeCode: input.contributionTypeCode ?? null, employeeRoleCode: input.employeeRoleCode ?? null,
    basisType: (input.basisType as any) ?? "FIXED_PER_CONTRIBUTION", fixedAmount: input.fixedAmount ?? null,
    perMinuteAmount: input.perMinuteAmount ?? null, ratePercent: input.ratePercent ?? null,
    weightMode: (input.weightMode as any) ?? "IGNORE_WEIGHT", minimumMinutes: input.minimumMinutes ?? null,
    maxAmount: input.maxAmount ?? null, priority: input.priority ?? 0, isActive: input.isActive ?? true,
  } as any });
  return created(rec);
});
